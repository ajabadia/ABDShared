#pragma once

#include <juce_core/juce_core.h>
#include <juce_data_structures/juce_data_structures.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <functional>
#include <mutex>
#include <string>
#include <vector>

namespace abd::hw {

/**
 * @brief Universal N:M MIDI Learn & CC/NRPN Mapping Manager for the ABDSynths suite.
 *
 * Features:
 * - Many-to-Many (N:M) routing:
 *   - 1 hardware CC/NRPN can modulate multiple UI parameters simultaneously (Macro mode),
 *     each with its own min/max range, polarity inversion, and response curve.
 *   - Multiple hardware CCs/NRPNs can control the same UI parameter.
 * - Replace vs. Add (Macro) learning modes.
 * - Protected CC filtering (Sustain 64, All Sound Off 120, Reset 121, All Notes Off 123).
 * - Full serialization to JSON (for WebView2 Bridge sync & file export) and juce::ValueTree
 *   (for DAW state persistence in getStateInformation / setStateInformation).
 */
class MidiLearnManager {
public:
    enum class SourceType : int {
        CC = 0,
        NRPN = 1,
        Aftertouch = 2,
        PitchBend = 3
    };

    enum class CurveType : int {
        Linear = 0,
        Exponential = 1,
        Logarithmic = 2
    };

    enum class LearnMode : int {
        None = 0,
        Replace = 1, // Replaces existing binding on targetParam, or moves CC if exclusive
        Add = 2      // Appends a new binding (Macro 1:N or N:1) without removing existing ones
    };

    struct Mapping {
        juce::String id;           // Unique binding ID (e.g. "ml_1")
        SourceType sourceType{SourceType::CC};
        int channel{0};            // 0 = Omni (All channels), 1..16 = specific MIDI channel
        int number{74};            // CC 0..127 or NRPN 0..16383
        int targetIndex{-1};       // Numeric parameter index (e.g. 0..444 in Axionik)
        juce::String targetKey;    // Canonical string parameter ID (optional, for APVTS string lookup)
        float minNorm{0.0f};       // Normalized minimum output [0..1]
        float maxNorm{1.0f};       // Normalized maximum output [0..1]
        bool invert{false};        // Invert polarity (127 -> minNorm, 0 -> maxNorm)
        CurveType curve{CurveType::Linear};
    };

    struct LastMidiActivity {
        bool valid{false};
        SourceType sourceType{SourceType::CC};
        int channel{1};
        int number{0};
        float normalizedValue{0.0f};
        int rawValue{0};
    };

    MidiLearnManager() = default;

    /**
     * @brief Returns true if the CC is a reserved system controller that should not be
     * accidentally captured during interactive MIDI Learn unless explicitly assigned.
     */
    static bool isProtectedCC(int ccNumber) noexcept {
        return ccNumber == 6 || ccNumber == 38 || ccNumber == 98 || ccNumber == 99 ||
               ccNumber == 100 || ccNumber == 101 ||
               ccNumber == 120 || ccNumber == 121 || ccNumber == 123;
    }

    /**
     * @brief Starts interactive MIDI Learn for a target parameter.
     */
    void startLearning(int targetIndex, const juce::String& targetKey = {}, LearnMode mode = LearnMode::Replace) {
        {
            std::scoped_lock lock(mutex_);
            learningTargetIndex_ = targetIndex;
            learningTargetKey_ = targetKey;
            learnMode_ = mode;
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

    /**
     * @brief Cancels any active MIDI Learn wait state.
     */
    void cancelLearning() {
        {
            std::scoped_lock lock(mutex_);
            learningTargetIndex_ = -1;
            learningTargetKey_.clear();
            learnMode_ = LearnMode::None;
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

    [[nodiscard]] bool isLearning() const noexcept {
        std::scoped_lock lock(mutex_);
        return learnMode_ != LearnMode::None && (learningTargetIndex_ >= 0 || learningTargetKey_.isNotEmpty());
    }

    /**
     * @brief Evaluates NormalizedInput [0..1] through Mapping range, polarity and curve.
     */
    static float evaluateMappingValue(const Mapping& m, float inputNorm01) noexcept {
        float x = std::clamp(inputNorm01, 0.0f, 1.0f);
        if (m.invert) {
            x = 1.0f - x;
        }
        switch (m.curve) {
            case CurveType::Exponential:
                x = x * x;
                break;
            case CurveType::Logarithmic:
                x = std::sqrt(x);
                break;
            case CurveType::Linear:
            default:
                break;
        }
        return std::clamp(m.minNorm + x * (m.maxNorm - m.minNorm), 0.0f, 1.0f);
    }

    /**
     * @brief Processes an incoming MIDI CC message.
     *
     * @param channel       MIDI channel 1..16
     * @param ccNumber      CC number 0..127
     * @param rawValue      CC value 0..127
     * @param onParamChange Callback invoked for each matched target: (targetIndex, targetKey, evaluatedNormalized01)
     * @return true if the CC was consumed by learning or matched at least one active mapping.
     */
    bool handleIncomingCC(
        int channel,
        int ccNumber,
        int rawValue,
        const std::function<void(int targetIndex, const juce::String& targetKey, float normVal)>& onParamChange)
    {
        return handleIncomingSource(
            SourceType::CC,
            channel,
            ccNumber,
            std::clamp(static_cast<float>(rawValue) / 127.0f, 0.0f, 1.0f),
            rawValue,
            onParamChange);
    }

    /**
     * @brief Processes an incoming 14-bit NRPN message.
     */
    bool handleIncomingNRPN(
        int channel,
        int nrpnNumber,
        float normalizedValue,
        int rawValue14Bit,
        const std::function<void(int targetIndex, const juce::String& targetKey, float normVal)>& onParamChange)
    {
        return handleIncomingSource(
            SourceType::NRPN,
            channel,
            nrpnNumber,
            std::clamp(normalizedValue, 0.0f, 1.0f),
            rawValue14Bit,
            onParamChange);
    }

    /**
     * @brief Generic handler for any MIDI control source.
     */
    bool handleIncomingSource(
        SourceType sourceType,
        int channel,
        int number,
        float normalizedValue,
        int rawValue,
        const std::function<void(int targetIndex, const juce::String& targetKey, float normVal)>& onParamChange)
    {
        if (sourceType == SourceType::CC && isProtectedCC(number)) {
            return false;
        }

        std::vector<Mapping> matched;
        {
            std::scoped_lock lock(mutex_);
            lastActivity_ = { true, sourceType, channel, number, normalizedValue, rawValue };
            activityPending_.store(true, std::memory_order_release);

            // 1. Check if waiting to learn
            if (learnMode_ != LearnMode::None && (learningTargetIndex_ >= 0 || learningTargetKey_.isNotEmpty())) {
                if (learnMode_ == LearnMode::Replace) {
                    // Remove existing bindings for this target parameter
                    mappings_.erase(
                        std::remove_if(mappings_.begin(), mappings_.end(), [&](const Mapping& m) {
                            return (learningTargetIndex_ >= 0 && m.targetIndex == learningTargetIndex_) ||
                                   (learningTargetKey_.isNotEmpty() && m.targetKey == learningTargetKey_);
                        }),
                        mappings_.end());
                }

                // Avoid exact duplicate (same source + same target)
                auto dupIt = std::find_if(mappings_.begin(), mappings_.end(), [&](const Mapping& m) {
                    bool sameTarget = (learningTargetIndex_ >= 0 && m.targetIndex == learningTargetIndex_) ||
                                      (learningTargetKey_.isNotEmpty() && m.targetKey == learningTargetKey_);
                    return sameTarget && m.sourceType == sourceType && m.number == number &&
                           (m.channel == 0 || m.channel == channel);
                });

                if (dupIt == mappings_.end()) {
                    Mapping next;
                    next.id = "ml_" + juce::String(++nextIdCounter_);
                    next.sourceType = sourceType;
                    next.channel = 0; // Default to Omni so hardware works immediately on any channel
                    next.number = number;
                    next.targetIndex = learningTargetIndex_;
                    next.targetKey = learningTargetKey_;
                    next.minNorm = 0.0f;
                    next.maxNorm = 1.0f;
                    next.invert = false;
                    next.curve = CurveType::Linear;
                    mappings_.push_back(next);
                }

                learningTargetIndex_ = -1;
                learningTargetKey_.clear();
                learnMode_ = LearnMode::None;
                stateChangedPending_.store(true, std::memory_order_release);
                return true;
            }

            // 2. Collect all N:M bindings matching this source
            for (const auto& m : mappings_) {
                if (m.sourceType == sourceType && m.number == number && (m.channel == 0 || m.channel == channel)) {
                    matched.push_back(m);
                }
            }
        }

        if (matched.empty()) {
            return false;
        }

        if (onParamChange) {
            for (const auto& m : matched) {
                float outNorm = evaluateMappingValue(m, normalizedValue);
                onParamChange(m.targetIndex, m.targetKey, outNorm);
            }
        }
        return true;
    }

    /**
     * @brief Adds or updates a mapping entry.
     */
    void upsertMapping(const Mapping& mapping) {
        {
            std::scoped_lock lock(mutex_);
            for (auto& existing : mappings_) {
                if (existing.id == mapping.id && mapping.id.isNotEmpty()) {
                    existing = mapping;
                    stateChangedPending_.store(true, std::memory_order_release);
                    return;
                }
            }
            Mapping copy = mapping;
            if (copy.id.isEmpty()) {
                copy.id = "ml_" + juce::String(++nextIdCounter_);
            }
            mappings_.push_back(copy);
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

    /**
     * @brief Removes a specific mapping by its unique ID.
     */
    void removeMappingById(const juce::String& id) {
        {
            std::scoped_lock lock(mutex_);
            mappings_.erase(
                std::remove_if(mappings_.begin(), mappings_.end(), [&](const Mapping& m) { return m.id == id; }),
                mappings_.end());
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

    /**
     * @brief Removes all mappings targeting a given parameter index.
     */
    void unbindTargetIndex(int targetIndex) {
        {
            std::scoped_lock lock(mutex_);
            mappings_.erase(
                std::remove_if(mappings_.begin(), mappings_.end(), [&](const Mapping& m) {
                    return m.targetIndex == targetIndex;
                }),
                mappings_.end());
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

    /**
     * @brief Clears all MIDI Learn mappings.
     */
    void clearMappings() {
        {
            std::scoped_lock lock(mutex_);
            mappings_.clear();
            learningTargetIndex_ = -1;
            learningTargetKey_.clear();
            learnMode_ = LearnMode::None;
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

    [[nodiscard]] std::vector<Mapping> getMappings() const {
        std::scoped_lock lock(mutex_);
        return mappings_;
    }

    /**
     * @brief Checks and clears the dirty flag for UI synchronization.
     */
    bool drainStateChangedFlag() noexcept {
        return stateChangedPending_.exchange(false, std::memory_order_acq_rel);
    }

    /**
     * @brief Drains the most recent MIDI input activity for UI monitor display.
     */
    bool drainLastMidiActivity(LastMidiActivity& out) noexcept {
        if (!activityPending_.exchange(false, std::memory_order_acq_rel)) {
            return false;
        }
        std::scoped_lock lock(mutex_);
        out = lastActivity_;
        return out.valid;
    }

    /**
     * @brief Serializes the full MIDI Learn state (active learning state + all N:M mappings) to JSON.
     */
    [[nodiscard]] juce::String toJson() const {
        std::scoped_lock lock(mutex_);
        auto* root = new juce::DynamicObject();
        root->setProperty("type", "MIDI_LEARN_STATE");
        root->setProperty("learningTargetIndex", learningTargetIndex_);
        root->setProperty("learningTargetKey", learningTargetKey_);
        root->setProperty("learnMode", static_cast<int>(learnMode_));

        juce::Array<juce::var> arr;
        for (const auto& m : mappings_) {
            auto* item = new juce::DynamicObject();
            item->setProperty("id", m.id);
            item->setProperty("sourceType", static_cast<int>(m.sourceType));
            item->setProperty("channel", m.channel);
            item->setProperty("number", m.number);
            item->setProperty("targetIndex", m.targetIndex);
            item->setProperty("targetKey", m.targetKey);
            item->setProperty("minNorm", m.minNorm);
            item->setProperty("maxNorm", m.maxNorm);
            item->setProperty("invert", m.invert);
            item->setProperty("curve", static_cast<int>(m.curve));
            arr.add(juce::var(item));
        }
        root->setProperty("mappings", arr);
        return juce::JSON::toString(juce::var(root), true);
    }

    /**
     * @brief Loads the full mapping table from a JSON string or array sent by the WebUI.
     */
    bool loadFromJson(const juce::String& jsonText, bool notifyUi = false) {
        juce::var parsed = juce::JSON::parse(jsonText);
        if (parsed.isVoid()) return false;
        return loadFromVar(parsed, notifyUi);
    }

    bool loadFromVar(const juce::var& data, bool notifyUi = false) {
        const juce::Array<juce::var>* list = nullptr;
        const juce::DynamicObject* rootObj = data.getDynamicObject();
        if (data.isArray()) {
            list = data.getArray();
        } else if (rootObj != nullptr) {
            if (rootObj->hasProperty("mappings") && rootObj->getProperty("mappings").isArray()) {
                list = rootObj->getProperty("mappings").getArray();
            }
        }
        if (list == nullptr) return false;

        std::vector<Mapping> nextMappings;
        uint32_t maxId = nextIdCounter_;
        for (const auto& item : *list) {
            auto* mObj = item.getDynamicObject();
            if (!mObj) continue;

            Mapping m;
            m.id = mObj->getProperty("id").toString();
            if (m.id.isEmpty()) {
                m.id = "ml_" + juce::String(++maxId);
            }
            m.sourceType = static_cast<SourceType>(std::clamp(static_cast<int>(mObj->getProperty("sourceType")), 0, 3));
            m.channel = std::clamp(static_cast<int>(mObj->getProperty("channel")), 0, 16);
            m.number = std::clamp(static_cast<int>(mObj->getProperty("number")), 0, 16383);
            m.targetIndex = static_cast<int>(mObj->getProperty("targetIndex"));
            m.targetKey = mObj->getProperty("targetKey").toString();
            m.minNorm = mObj->hasProperty("minNorm") ? std::clamp(static_cast<float>(mObj->getProperty("minNorm")), 0.0f, 1.0f) : 0.0f;
            m.maxNorm = mObj->hasProperty("maxNorm") ? std::clamp(static_cast<float>(mObj->getProperty("maxNorm")), 0.0f, 1.0f) : 1.0f;
            m.invert = static_cast<bool>(mObj->getProperty("invert"));
            m.curve = static_cast<CurveType>(std::clamp(static_cast<int>(mObj->getProperty("curve")), 0, 2));
            nextMappings.push_back(m);
        }

        {
            std::scoped_lock lock(mutex_);
            mappings_ = std::move(nextMappings);
            nextIdCounter_ = std::max(nextIdCounter_, maxId + 1);
            if (rootObj != nullptr && rootObj->hasProperty("learnMode")) {
                learningTargetIndex_ = rootObj->hasProperty("learningTargetIndex")
                    ? static_cast<int>(rootObj->getProperty("learningTargetIndex"))
                    : -1;
                learningTargetKey_ = rootObj->getProperty("learningTargetKey").toString();
                auto modeVar = rootObj->getProperty("learnMode");
                if (modeVar.isString()) {
                    auto modeStr = modeVar.toString();
                    learnMode_ = (modeStr == "add") ? LearnMode::Add
                               : (modeStr == "replace") ? LearnMode::Replace
                               : LearnMode::None;
                } else {
                    int modeInt = static_cast<int>(modeVar);
                    learnMode_ = (modeInt == 2) ? LearnMode::Add
                               : (modeInt == 1) ? LearnMode::Replace
                               : LearnMode::None;
                }
            }
        }
        if (notifyUi) {
            stateChangedPending_.store(true, std::memory_order_release);
        }
        return true;
    }

    /**
     * @brief Serializes mappings to a juce::ValueTree for DAW project state persistence.
     */
    [[nodiscard]] juce::ValueTree saveState() const {
        std::scoped_lock lock(mutex_);
        juce::ValueTree vt("MidiLearn");
        for (const auto& m : mappings_) {
            juce::ValueTree entry("Mapping");
            entry.setProperty("id", m.id, nullptr);
            entry.setProperty("sourceType", static_cast<int>(m.sourceType), nullptr);
            entry.setProperty("channel", m.channel, nullptr);
            entry.setProperty("number", m.number, nullptr);
            entry.setProperty("targetIndex", m.targetIndex, nullptr);
            entry.setProperty("targetKey", m.targetKey, nullptr);
            entry.setProperty("minNorm", m.minNorm, nullptr);
            entry.setProperty("maxNorm", m.maxNorm, nullptr);
            entry.setProperty("invert", m.invert, nullptr);
            entry.setProperty("curve", static_cast<int>(m.curve), nullptr);
            vt.addChild(entry, -1, nullptr);
        }
        return vt;
    }

    /**
     * @brief Restores mappings from a juce::ValueTree saved in DAW project state.
     */
    void loadState(const juce::ValueTree& vt) {
        if (!vt.isValid() || !vt.hasType("MidiLearn")) {
            return;
        }
        std::vector<Mapping> nextMappings;
        uint32_t maxId = nextIdCounter_;
        for (int i = 0; i < vt.getNumChildren(); ++i) {
            auto child = vt.getChild(i);
            if (!child.hasType("Mapping")) continue;
            Mapping m;
            m.id = child.getProperty("id", "ml_" + juce::String(++maxId)).toString();
            m.sourceType = static_cast<SourceType>(static_cast<int>(child.getProperty("sourceType", 0)));
            m.channel = std::clamp(static_cast<int>(child.getProperty("channel", 0)), 0, 16);
            m.number = std::clamp(static_cast<int>(child.getProperty("number", 0)), 0, 16383);
            m.targetIndex = static_cast<int>(child.getProperty("targetIndex", -1));
            m.targetKey = child.getProperty("targetKey", "").toString();
            m.minNorm = std::clamp(static_cast<float>(child.getProperty("minNorm", 0.0f)), 0.0f, 1.0f);
            m.maxNorm = std::clamp(static_cast<float>(child.getProperty("maxNorm", 1.0f)), 0.0f, 1.0f);
            m.invert = static_cast<bool>(child.getProperty("invert", false));
            m.curve = static_cast<CurveType>(std::clamp(static_cast<int>(child.getProperty("curve", 0)), 0, 2));
            nextMappings.push_back(m);
        }

        {
            std::scoped_lock lock(mutex_);
            mappings_ = std::move(nextMappings);
            nextIdCounter_ = std::max(nextIdCounter_, maxId + 1);
        }
        stateChangedPending_.store(true, std::memory_order_release);
    }

private:
    mutable std::mutex mutex_;
    std::vector<Mapping> mappings_;
    int learningTargetIndex_{-1};
    juce::String learningTargetKey_;
    LearnMode learnMode_{LearnMode::None};
    uint32_t nextIdCounter_{100};
    LastMidiActivity lastActivity_{};
    std::atomic<bool> stateChangedPending_{false};
    std::atomic<bool> activityPending_{false};
};

} // namespace abd::hw

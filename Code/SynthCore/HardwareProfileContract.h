#pragma once

#include "SemanticRoleHash.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace abd::synth
{

enum class ControlWireMethod : std::uint8_t
{
    None = 0,
    MidiCc,
    Nrpn7Bit,
    Nrpn14Bit,
    SysEx,
    Manual
};

/**
 * @brief Single semantic control hydrated from a hardware JSON contract.
 */
struct SemanticControlBinding
{
    std::string semanticRole;
    std::uint64_t roleHash { 0 };
    std::string name;
    std::string functionId;

    ControlWireMethod method { ControlWireMethod::None };
    std::uint8_t controlNumber { 0 }; // CC number or NRPN MSB
    std::uint8_t subNumber { 0 };     // NRPN LSB
    std::string sysexAddress;

    float wireMin { 0.0f };
    float wireMax { 127.0f };
    float wireDefault { 64.0f };
    bool isPerKeyDrum { false };
};

/**
 * @brief Hardware MIDI identity and SysEx protocol metadata from contract JSON.
 */
struct HardwareIdentityMeta
{
    std::string manufacturer;
    std::vector<std::uint8_t> manufacturerIdBytes;
    std::string model;
    std::vector<std::uint8_t> modelIdBytes;
    std::vector<std::uint8_t> sysexHeaderBytes;
    std::vector<std::string> portNameMatches;

    std::uint8_t defaultDeviceId { 0x10 };
    std::uint8_t defaultChannel { 1 };
    bool useRolandChecksum { false };
};

/**
 * @brief Universal, aseptic, data-driven hardware profile hydrated from JSON contracts.
 * Pre-built flat indices guarantee O(1)/O(log N) zero-allocation lookups on the audio/MIDI thread.
 */
struct UniversalHardwareProfile
{
    std::string id { "generic_midi" };
    std::string displayName { "Generic MIDI Device" };
    std::vector<std::string> aliases;
    HardwareIdentityMeta identity;

    std::vector<SemanticControlBinding> bindings;

    // Pre-built RT-safe lookup tables (populated by rebuildLookupTables() on non-RT thread)
    std::vector<std::pair<std::uint64_t, std::int16_t>> roleHashIndex;
    std::array<std::int16_t, 128> ccLookup {};
    std::vector<std::pair<std::uint16_t, std::int16_t>> nrpnLookup;
    std::array<std::int16_t, 128> drumNrpnMsbLookup {};

    UniversalHardwareProfile()
    {
        ccLookup.fill(-1);
        drumNrpnMsbLookup.fill(-1);
    }

    void rebuildLookupTables()
    {
        roleHashIndex.clear();
        nrpnLookup.clear();
        ccLookup.fill(-1);
        drumNrpnMsbLookup.fill(-1);

        roleHashIndex.reserve(bindings.size());
        for (std::size_t i = 0; i < bindings.size(); ++i)
        {
            const auto idx = static_cast<std::int16_t>(i);
            const auto& b = bindings[i];
            if (b.roleHash != 0)
                roleHashIndex.emplace_back(b.roleHash, idx);

            if (b.method == ControlWireMethod::MidiCc && b.controlNumber < 128)
            {
                if (ccLookup[b.controlNumber] < 0)
                    ccLookup[b.controlNumber] = idx;
            }
            else if (b.method == ControlWireMethod::Nrpn7Bit || b.method == ControlWireMethod::Nrpn14Bit)
            {
                if (b.isPerKeyDrum && b.controlNumber < 128)
                {
                    if (drumNrpnMsbLookup[b.controlNumber] < 0)
                        drumNrpnMsbLookup[b.controlNumber] = idx;
                }
                else
                {
                    const std::uint16_t key = static_cast<std::uint16_t>(
                        (static_cast<std::uint16_t>(b.controlNumber & 0x7Fu) << 7) | (b.subNumber & 0x7Fu));
                    nrpnLookup.emplace_back(key, idx);
                }
            }
        }

        std::sort(roleHashIndex.begin(), roleHashIndex.end(),
                  [](const auto& a, const auto& b) { return a.first < b.first; });
        std::sort(nrpnLookup.begin(), nrpnLookup.end(),
                  [](const auto& a, const auto& b) { return a.first < b.first; });
    }

    [[nodiscard]] const SemanticControlBinding* findByRoleHash(std::uint64_t hash) const noexcept
    {
        const auto it = std::lower_bound(roleHashIndex.begin(), roleHashIndex.end(), hash,
                                         [](const auto& elem, std::uint64_t h) { return elem.first < h; });
        if (it != roleHashIndex.end() && it->first == hash)
            return &bindings[static_cast<std::size_t>(it->second)];
        return nullptr;
    }

    [[nodiscard]] const SemanticControlBinding* findByCc(std::uint8_t cc) const noexcept
    {
        if (cc >= 128) return nullptr;
        const std::int16_t idx = ccLookup[cc];
        return (idx >= 0) ? &bindings[static_cast<std::size_t>(idx)] : nullptr;
    }

    [[nodiscard]] const SemanticControlBinding* findByNrpn(std::uint8_t msb, std::uint8_t lsb) const noexcept
    {
        const std::uint16_t key = static_cast<std::uint16_t>(
            (static_cast<std::uint16_t>(msb & 0x7Fu) << 7) | (lsb & 0x7Fu));
        const auto it = std::lower_bound(nrpnLookup.begin(), nrpnLookup.end(), key,
                                         [](const auto& elem, std::uint16_t k) { return elem.first < k; });
        if (it != nrpnLookup.end() && it->first == key)
            return &bindings[static_cast<std::size_t>(it->second)];
        return nullptr;
    }

    [[nodiscard]] const SemanticControlBinding* findDrumByNrpnMsb(std::uint8_t msb) const noexcept
    {
        if (msb >= 128) return nullptr;
        const std::int16_t idx = drumNrpnMsbLookup[msb];
        return (idx >= 0) ? &bindings[static_cast<std::size_t>(idx)] : nullptr;
    }

    [[nodiscard]] bool matchesIdentityReply(const std::uint8_t* sysex, std::size_t len) const noexcept
    {
        if (!sysex || len < 5 || identity.manufacturerIdBytes.empty())
            return false;

        // Strip framing F0 / F7 if caller passed full SysEx frame
        std::size_t offset = 0;
        std::size_t payloadLen = len;
        if (sysex[0] == 0xF0) { offset = 1; --payloadLen; }
        if (payloadLen > 0 && sysex[offset + payloadLen - 1] == 0xF7) { --payloadLen; }
        if (payloadLen < 5) return false;

        const std::uint8_t* p = sysex + offset;
        if (p[0] != 0x7E || p[2] != 0x06 || p[3] != 0x02)
            return false;

        const auto& mfg = identity.manufacturerIdBytes;
        if (payloadLen < 4 + mfg.size()) return false;
        for (std::size_t i = 0; i < mfg.size(); ++i)
            if (p[4 + i] != mfg[i]) return false;

        if (identity.modelIdBytes.empty()) return true;

        const std::size_t familyOffset = 4 + mfg.size();
        const auto& mod = identity.modelIdBytes;
        const auto matchAt = [&](std::size_t pos) noexcept -> bool {
            if (payloadLen < pos + mod.size()) return false;
            for (std::size_t i = 0; i < mod.size(); ++i)
                if (p[pos + i] != mod[i]) return false;
            return true;
        };
        return matchAt(familyOffset + 2) || matchAt(familyOffset);
    }

    [[nodiscard]] bool matchesPortName(std::string_view portName) const noexcept
    {
        for (const auto& kw : identity.portNameMatches)
        {
            if (kw.empty() || kw.size() > portName.size()) continue;
            for (std::size_t i = 0; i + kw.size() <= portName.size(); ++i)
            {
                bool eq = true;
                for (std::size_t j = 0; j < kw.size(); ++j)
                {
                    if (std::tolower(static_cast<unsigned char>(portName[i + j])) !=
                        std::tolower(static_cast<unsigned char>(kw[j])))
                    {
                        eq = false;
                        break;
                    }
                }
                if (eq) return true;
            }
        }
        return false;
    }

    [[nodiscard]] bool matchesIdOrAlias(std::string_view query) const noexcept
    {
        auto ieq = [](std::string_view a, std::string_view b) noexcept -> bool {
            if (a.size() != b.size()) return false;
            for (std::size_t i = 0; i < a.size(); ++i)
                if (std::tolower(static_cast<unsigned char>(a[i])) !=
                    std::tolower(static_cast<unsigned char>(b[i])))
                    return false;
            return true;
        };
        if (ieq(id, query)) return true;
        for (const auto& a : aliases)
            if (ieq(a, query)) return true;
        return false;
    }
};

} // namespace abd::synth

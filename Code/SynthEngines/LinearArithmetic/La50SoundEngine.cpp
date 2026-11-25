#include "La50SoundEngine.h"
#include "La50FactoryPresets.h"
#include "La50ParamCodec.h"
#include "La50SysexCodec.h"
#include <algorithm>
#include <cmath>
#include <cstdio>

namespace abd::engines {

namespace {

float softSaturate(float x) noexcept
{
    constexpr float kKnee = 0.7f; const float a = std::abs(x);
    if (a <= kKnee) return x;
    const float over = (a - kKnee) / (1.0f - kKnee);
    return (x < 0.0f ? -1.0f : 1.0f) * (kKnee + (1.0f - kKnee) * (over / (1.0f + over)));
}
} // namespace

La50SoundEngine::La50SoundEngine() noexcept { la50::loadFactoryPresetPatch(0, patch_); setCurrentPresetName(la50::getFactoryPresetMeta(0).name); }

void La50SoundEngine::ensureKernel() noexcept
{
    if (!kernel_) kernel_ = std::make_unique<Kernel>();
    const double sr = sampleRate_ > 100.0 ? sampleRate_ : 44100.0;
    kernel_->upperTone.prepare(sr);
    kernel_->lowerTone.prepare(sr);
    kernel_->reverb.prepare(sr);
    const std::size_t lagLen = std::max<std::size_t>(16u, static_cast<std::size_t>(sr * 0.004) + 1u);
    kernel_->lagL.assign(lagLen, 0.0f);
    kernel_->lagR.assign(lagLen, 0.0f);
    kernel_->lagWritePos = 0;
    applyPatchToKernel();
}

void La50SoundEngine::attachWavePool(const abd::rompler::RomplerWavePool* sharedWavePool) noexcept { wavePool_ = sharedWavePool; }
void La50SoundEngine::setPreferredBankId(std::string_view bankId) noexcept { if (!bankId.empty()) preferredBankId_.assign(bankId.data(), bankId.size()); }

void La50SoundEngine::setModelProfile(la50::LaModelProfile profile) noexcept
{
    patch_.profile = profile;
    preferredBankId_ = la50::getPreferredBankIdForProfile(profile);
    applyPatchToKernel();
}

la50::La50PcmSampleView La50SoundEngine::lookupWaveCallback(void* ctx, int pcmIndex) noexcept { return ctx ? static_cast<const La50SoundEngine*>(ctx)->resolveWave(pcmIndex) : la50::La50PcmSampleView {}; }

la50::La50PcmSampleView La50SoundEngine::resolveWave(int pcmIndex) const noexcept
{
    if (!wavePool_) return {};
    const bool mt32 = la50::isLa32Profile(patch_.profile);
    const int idx = mt32 ? (pcmIndex % static_cast<int>(la50::getLaModelFeatures(patch_.profile).pcmCount)) : (pcmIndex + 1);
    char idBuf[16]; std::snprintf(idBuf, sizeof(idBuf), "w_%04d", idx);
    abd::rompler::WaveHandle h = wavePool_->findHandle(preferredBankId_, idBuf);
    if (h == abd::rompler::kInvalidWaveHandle && mt32)
        for (const char* b : { "roland_cm32l_v102", "roland_d110_v110", "roland_mt32_v107" })
            if ((h = wavePool_->findHandle(b, idBuf)) != abd::rompler::kInvalidWaveHandle) break;
    const auto* asset = (h != abd::rompler::kInvalidWaveHandle) ? wavePool_->get(h) : nullptr;
    if (!asset || !asset->dataL() || asset->frameCount() <= 0) return {};
    return { asset->dataL(), asset->frameCount(), asset->loopStart, asset->loopEnd, asset->sampleRate, asset->isLooping, asset->rootKey, asset->fineTuneCents };
}

void La50SoundEngine::applyPatchToKernel() noexcept
{
    if (!kernel_) return;
    la50::La50ToneParams u = patch_.upper, l = patch_.lower;
    auto mod = [&](la50::La50ToneParams& dst) {
        la50::applyLa50ToneModulation(dst, controlOffset(ControlInputId::TvfCutoff), controlOffset(ControlInputId::TvfResonance),
            controlOffset(ControlInputId::TvaAttack), controlOffset(ControlInputId::TvaRelease), controlOffset(ControlInputId::ChorusMix),
            controlOffset(ControlInputId::TvaDecay), controlOffset(ControlInputId::VibratoDepth));
    };
    mod(u); mod(l);
    kernel_->upperTone.setToneParams(patch_.profile, u);
    kernel_->lowerTone.setToneParams(patch_.profile, l);
    const float revSend = controlOffset(ControlInputId::ReverbSend);
    const int revBal = std::clamp(static_cast<int>(patch_.reverbBalance) + static_cast<int>(revSend * 50.0f), 0, 100);
    kernel_->reverb.setMt32Compatible(la50::getLaModelFeatures(patch_.profile).defaultReverbMT32Compatible, la50::isLa32Profile(patch_.profile));
    static constexpr int kRa50RevProg[8] = { 6, 7, 0, 2, 5, 18, 10, 12 };
    const int revType = ((patch_.profile == la50::LaModelProfile::kRa50 || la50::isD110WaveProfile(patch_.profile)) && patch_.reverbType < 8)
        ? kRa50RevProg[patch_.reverbType] : static_cast<int>(patch_.reverbType);
    kernel_->reverb.setParameters(revType, 100, revBal);
}

void La50SoundEngine::prepare(double sampleRate, int maxBlockSize) noexcept
{
    sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
    maxBlockSize_ = std::clamp(maxBlockSize, 32, 8192);
    prepared_ = true;
    if (!deferKernelUntilActive_ || kernel_) ensureKernel();
    reset();
}

void La50SoundEngine::reset() noexcept
{
    sustainDown_ = false; reverbTailCounter_ = 0; controlInputs_.fill(0.0f);
    if (!kernel_) return;
    kernel_->upperTone.reset(); kernel_->lowerTone.reset(); kernel_->reverb.reset();
    std::fill(kernel_->lagL.begin(), kernel_->lagL.end(), 0.0f);
    std::fill(kernel_->lagR.begin(), kernel_->lagR.end(), 0.0f);
    kernel_->lagWritePos = 0; kernel_->lpfPrevL = kernel_->lpfPrevR = 0.0f;
}

EngineDescriptor La50SoundEngine::getDescriptor() const noexcept { return { getEngineTypeId(), getEngineDisplayName(), false, true, 16 }; }
int La50SoundEngine::getFactoryPresetCount() const noexcept { return static_cast<int>(la50::kFactoryPresetCount); }
const char* La50SoundEngine::getFactoryPresetName(int index) const noexcept { return (index >= 0 && index < getFactoryPresetCount()) ? la50::getFactoryPresetMeta(static_cast<std::size_t>(index)).name : ""; }

int La50SoundEngine::getFactoryPresetCategory(int index) const noexcept
{
    static constexpr std::array<int, la50::kFactoryPresetCount> kCats {{ 4,2,3,1,6,6,4,5,9,3,5,1,2,0,4,4,0,2,6,1,6,6,4,5,0,0,0,1,6,0,4,5,2,2,0,1,4,0,0,5,4,2,3,1,1,6,4,3,4,2,3,1,6,1,0,0,9,0,3,0,0,0,4,5 }};
    return (index >= 0 && index < getFactoryPresetCount()) ? kCats[static_cast<std::size_t>(index)] : 0;
}

bool La50SoundEngine::loadFactoryPreset(int index) noexcept
{
    if (index < 0 || index >= getFactoryPresetCount()) return false;
    la50::loadFactoryPresetPatch(static_cast<std::size_t>(index), patch_);
    setCurrentPresetName(la50::getFactoryPresetMeta(static_cast<std::size_t>(index)).name);
    if (prepared_ && !kernel_) ensureKernel();
    applyPatchToKernel();
    return true;
}

bool La50SoundEngine::loadSysexBytes(const std::uint8_t* data, std::size_t size, int patchIndex) noexcept
{
    std::vector<la50::La50Patch> parsed;
    if ((!la50::parseD50SyxStream(data, size, parsed) && !la50::parseMt32SyxStream(data, size, parsed)) || parsed.empty()) return false;
    patch_ = parsed[static_cast<std::size_t>(std::clamp(patchIndex, 0, static_cast<int>(parsed.size()) - 1))];
    setCurrentPresetName(patch_.name.data());
    if (prepared_ && !kernel_) ensureKernel();
    applyPatchToKernel();
    return true;
}

bool La50SoundEngine::loadRawPatch448(const std::uint8_t* bytes448) noexcept
{
    if (!bytes448) return false;
    la50::decodeD50Patch448(bytes448, patch_);
    setCurrentPresetName(patch_.name.data());
    if (prepared_ && !kernel_) ensureKernel();
    applyPatchToKernel();
    return true;
}

bool La50SoundEngine::loadMt32Timbre246(const std::uint8_t* bytes246) noexcept
{
    if (!bytes246) return false;
    la50::decodeMt32Timbre246(bytes246, patch_);
    setPreferredBankId("roland_cm32l_v102");
    setCurrentPresetName(patch_.name.data());
    if (prepared_ && !kernel_) ensureKernel();
    applyPatchToKernel();
    return true;
}

void La50SoundEngine::setCurrentPresetName(const char* name) noexcept
{
    currentPresetName_.fill('\0');
    if (!name) return;
    for (std::size_t i = 0; i + 1 < currentPresetName_.size() && name[i] != '\0'; ++i) currentPresetName_[i] = name[i];
}

bool La50SoundEngine::setParamByKey(std::string_view key, float value) noexcept { if (!la50::setLa50ParamByKey(patch_, key, value)) return false; if (key == "modelProfile") setModelProfile(patch_.profile); else applyPatchToKernel(); return true; }
bool La50SoundEngine::getParamByKey(std::string_view key, float& outValue) const noexcept { return la50::getLa50ParamByKey(patch_, key, outValue); }
std::string La50SoundEngine::serializeStateJson() const { return la50::serializeLa50StateJson(patch_, currentPresetName_.data()); }

bool La50SoundEngine::deserializeStateJson(std::string_view jsonText)
{
    std::string presetName;
    if (!la50::deserializeLa50StateJson(jsonText, patch_, presetName)) return false;
    setCurrentPresetName(!presetName.empty() ? presetName.c_str() : patch_.name.data());
    if (prepared_ && !kernel_) ensureKernel();
    applyPatchToKernel();
    return true;
}

const EngineControlInputDescriptor* La50SoundEngine::getControlInputDescriptors(std::size_t& outCount) const noexcept
{
    return la50::getLa50ControlDescriptors(outCount);
}

void La50SoundEngine::setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept
{
    if (!valuesByDestId || arraySize == 0) { clearControlInputs(); return; }
    const std::size_t count = std::min(kNumControlInputs, arraySize);
    bool changed = false;
    controlInputs_[0] = 0.0f;
    for (std::size_t i = 1; i < kNumControlInputs; ++i)
    {
        const float nextVal = (i < count) ? std::clamp(valuesByDestId[i], -1.0f, 1.0f) : 0.0f;
        if (std::abs(controlInputs_[i] - nextVal) > 1.0e-6f) { controlInputs_[i] = nextVal; changed = true; }
    }
    if (changed) applyPatchToKernel();
}

void La50SoundEngine::clearControlInputs() noexcept { controlInputs_.fill(0.0f); applyPatchToKernel(); }
float La50SoundEngine::controlOffset(ControlInputId id) const noexcept { const auto i = static_cast<std::size_t>(id); return (i < kNumControlInputs) ? controlInputs_[i] : 0.0f; }

void La50SoundEngine::setTransportContext(const EngineTransportContext& ctx) noexcept
{
    transport_ = ctx;
    if (!kernel_) return;
    kernel_->upperTone.updateLiveControls(transport_.pitchBendSemitones, transport_.modWheel01, transport_.aftertouch01);
    kernel_->lowerTone.updateLiveControls(transport_.pitchBendSemitones, transport_.modWheel01, transport_.aftertouch01);
}

void La50SoundEngine::noteOn(int midiNote, float velocity01, float) noexcept
{
    if (!kernel_) return;
    const int note = std::clamp(midiNote, 0, 127);
    const float bend = transport_.pitchBendSemitones + controlOffset(ControlInputId::PitchOffset) * 12.0f;
    const bool playLower = (patch_.keyMode == la50::KeyMode::kDual) || (patch_.keyMode == la50::KeyMode::kSplit && note < static_cast<int>(patch_.splitPoint));
    const bool playUpper = (patch_.keyMode != la50::KeyMode::kSplit) || !playLower;
    if (playUpper)
        kernel_->upperTone.noteOn(note, velocity01, patch_.solo || patch_.soloUpper, bend, transport_.modWheel01, transport_.aftertouch01, patch_.portaSwitch && patch_.portaMode != 1, patch_.portaTime, &lookupWaveCallback, this);
    if (playLower)
        kernel_->lowerTone.noteOn(note, velocity01, patch_.solo || patch_.soloLower, bend, transport_.modWheel01, transport_.aftertouch01, patch_.portaSwitch && patch_.portaMode != 0, patch_.portaTime, &lookupWaveCallback, this);
    reverbTailCounter_ = static_cast<int>(sampleRate_ * 2.5);
    kernel_->reverb.noteActivity();
}

void La50SoundEngine::noteOff(int midiNote) noexcept
{
    if (!kernel_) return;
    const int n = std::clamp(midiNote, 0, 127);
    kernel_->upperTone.noteOff(n, sustainDown_); kernel_->lowerTone.noteOff(n, sustainDown_);
}

void La50SoundEngine::allNotesOff() noexcept
{
    sustainDown_ = false;
    if (kernel_) { kernel_->upperTone.allNotesOff(); kernel_->lowerTone.allNotesOff(); }
}

void La50SoundEngine::setSustainPedal(bool down) noexcept
{
    sustainDown_ = down;
    if (!down && kernel_) { kernel_->upperTone.releaseSustained(); kernel_->lowerTone.releaseSustained(); }
}

bool La50SoundEngine::renderBlock(float* outL, float* outR, int numSamples) noexcept
{
    if (!outL || !outR || numSamples <= 0) return false;
    if (!kernel_ || (!(kernel_->upperTone.anySounding() || kernel_->lowerTone.anySounding()) && reverbTailCounter_ <= 0))
    { std::fill_n(outL, static_cast<std::size_t>(numSamples), 0.0f); std::fill_n(outR, static_cast<std::size_t>(numSamples), 0.0f); return false; }
    if (!(kernel_->upperTone.anySounding() || kernel_->lowerTone.anySounding()))
        reverbTailCounter_ = std::max(0, reverbTailCounter_ - numSamples);

    const float uBal = static_cast<float>(patch_.upperBalance) * 0.01f;
    const float uGain = (patch_.keyMode == la50::KeyMode::kWhole) ? 1.0f : std::min(2.0f * uBal, 1.275f);
    const float lGain = (patch_.keyMode == la50::KeyMode::kWhole) ? 0.0f : std::min(2.0f * (1.0f - uBal), 1.275f);
    const float vol = static_cast<float>(patch_.totalVolume) * 0.01f * std::max(0.0f, 1.0f + controlOffset(ControlInputId::AmpLevel));
    const bool isLa32 = la50::isLa32Profile(patch_.profile);
    const float lpfTap = la50::getLaModelFeatures(patch_.profile).oldMT32AnalogLPF ? -0.17f : -0.24f;

    for (int offset = 0; offset < numSamples;)
    {
        const int chunk = std::min(numSamples - offset, 512);
        kernel_->upperTone.renderBlock(kernel_->upperL.data(), kernel_->upperR.data(), chunk);
        if (patch_.keyMode != la50::KeyMode::kWhole) kernel_->lowerTone.renderBlock(kernel_->lowerL.data(), kernel_->lowerR.data(), chunk);
        else { std::fill_n(kernel_->lowerL.data(), static_cast<std::size_t>(chunk), 0.0f); std::fill_n(kernel_->lowerR.data(), static_cast<std::size_t>(chunk), 0.0f); }

        const std::size_t lagLen = kernel_->lagL.size();
        for (int i = 0; i < chunk; ++i)
        {
            const std::size_t rp = (kernel_->lagWritePos + 1u) % lagLen, ui = static_cast<std::size_t>(i);
            const float loL = kernel_->lagL[rp], loR = kernel_->lagR[rp];
            kernel_->lagL[kernel_->lagWritePos] = kernel_->lowerL[ui]; kernel_->lagR[kernel_->lagWritePos] = kernel_->lowerR[ui];
            kernel_->lagWritePos = rp;

            const float upL = kernel_->upperL[ui] * uGain, upR = kernel_->upperR[ui] * uGain, lwL = loL * lGain, lwR = loR * lGain;
            const bool monoSplit = (patch_.keyMode != la50::KeyMode::kWhole && patch_.outputMode != 0);
            const float dryL = monoSplit ? (patch_.outputMode == 2 ? 0.0f : lwL) : 0.5f * (upL + lwL);
            const float dryR = monoSplit ? (patch_.outputMode == 3 ? 0.0f : upL) : 0.5f * (upR + lwR);
            const float sendMono = monoSplit ? (patch_.outputMode == 2 ? upL : (patch_.outputMode == 3 ? lwL : 0.5f * (lwL + upL))) : 0.5f * (upL + lwL);
            float revL = 0.0f, revR = 0.0f;
            kernel_->reverb.processD50Mix(sendMono, dryL, dryR, revL, revR);
            if (monoSplit && patch_.outputMode == 2) revL = lwL;
            else if (monoSplit && patch_.outputMode == 3) revR = upL;
            if (isLa32)
            {
                const float inL = revL, inR = revR;
                revL = (1.0f - lpfTap) * inL + lpfTap * kernel_->lpfPrevL;
                revR = (1.0f - lpfTap) * inR + lpfTap * kernel_->lpfPrevR;
                kernel_->lpfPrevL = inL; kernel_->lpfPrevR = inR;
            }
            outL[offset + i] = softSaturate(revL * vol); outR[offset + i] = softSaturate(revR * vol);
        }
        offset += chunk;
    }
    return true;
}

} // namespace abd::engines

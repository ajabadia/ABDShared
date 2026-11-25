#pragma once

#include "SynthEngines/ISoundEngine.h"
#include "La50Types.h"
#include <array>
#include <string>
#include <string_view>

namespace abd::engines::la50 {

bool setLa50ParamByKey(La50Patch& patch, std::string_view key, float value) noexcept;
bool getLa50ParamByKey(const La50Patch& patch, std::string_view key, float& outValue) noexcept;
std::string serializeLa50StateJson(const La50Patch& patch, const char* presetName);
bool deserializeLa50StateJson(std::string_view jsonText, La50Patch& patch, std::string& outPresetName);

void applyLa50ToneModulation(La50ToneParams& t, float dCut, float dRes, float dAtt, float dRel, float dChr,
                             float dDec = 0.0f, float dVib = 0.0f) noexcept;
const abd::engines::EngineControlInputDescriptor* getLa50ControlDescriptors(std::size_t& outCount) noexcept;

} // namespace abd::engines::la50

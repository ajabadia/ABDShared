#pragma once

#include <string_view>

namespace abd::rompler
{

class StructuredRomplerEngine;

/**
 * @brief RT-safe zero-allocation parameter codec addressing StructuredRomplerEngine
 * fields by canonical string key (e.g. "p1.cutoffHz", "filter2.mode", "drum.36.muteGroup").
 */
class RomplerParamCodec
{
public:
    static bool setParam(StructuredRomplerEngine& engine, std::string_view key, float value) noexcept;
    [[nodiscard]] static bool getParam(const StructuredRomplerEngine& engine,
                                       std::string_view key,
                                       float& outValue) noexcept;
};

} // namespace abd::rompler

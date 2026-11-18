#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <span>
#include <string>
#include <string_view>

namespace abd::synth
{

/**
 * @brief Representation of a 2-line alphanumeric LCD screen (e.g. 16x2, 20x2).
 */
struct LcdScreenLines
{
    std::string line1;
    std::string line2;
};

/**
 * @brief Universal text formatter for alphanumeric LCD displays (16x2, 20x2, etc.).
 *
 * C++20 pure standard library, zero dependencies, RT-safe & allocation-friendly.
 * Converged from ABDMS2000::LCDMenuFormatter, ABDEep script_lcd_core, and ABDShared LCD_GUIDE.
 */
class LcdTextFormatter
{
public:
    static constexpr int kDefaultWidth16 = 16;
    static constexpr int kDefaultWidth20 = 20;

    /// Truncates to exactly `width` chars or pads with trailing spaces.
    static std::string pad(std::string_view str, int width = kDefaultWidth16)
    {
        if (width <= 0)
            return {};
        const size_t target = static_cast<size_t>(width);
        if (str.length() >= target)
            return std::string(str.substr(0, target));
        std::string res(str);
        res.append(target - str.length(), ' ');
        return res;
    }

    /// Legacy 16-char pad helper for backward compatibility with ABDMS2000.
    static std::string pad16(std::string_view str)
    {
        return pad(str, kDefaultWidth16);
    }

    /// Centers text within `width` chars, padding left and right with spaces.
    static std::string formatCenter(std::string_view str, int width = kDefaultWidth16)
    {
        if (width <= 0)
            return {};
        const size_t target = static_cast<size_t>(width);
        if (str.length() >= target)
            return std::string(str.substr(0, target));
        const size_t totalPad = target - str.length();
        const size_t leftPad = totalPad / 2;
        const size_t rightPad = totalPad - leftPad;
        std::string res;
        res.reserve(target);
        res.append(leftPad, ' ');
        res.append(str);
        res.append(rightPad, ' ');
        return res;
    }

    /// Formats a 2-line Play/Patch mode screen (e.g. Line 1: "Prog: A11", Line 2: "[Init Synth]").
    static LcdScreenLines formatPlayMode(std::string_view bank, int progNum, std::string_view progName, int width = kDefaultWidth16)
    {
        const std::string l1 = "Prog: " + std::string(bank) + std::to_string(progNum);
        const std::string l2 = "[" + std::string(progName) + "]";
        return { pad(l1, width), pad(l2, width) };
    }

    /// Formats a parameter line aligning label on the left and value on the right (e.g. "Cutoff     :  72").
    static std::string formatParamLine(std::string_view label, std::string_view valueStr, int width = kDefaultWidth16)
    {
        if (width <= 0)
            return {};
        const size_t target = static_cast<size_t>(width);
        constexpr std::string_view sep = " :";
        if (label.length() + sep.length() + valueStr.length() <= target)
        {
            const size_t fillSpaces = target - (label.length() + sep.length() + valueStr.length());
            std::string res;
            res.reserve(target);
            res.append(label);
            res.append(fillSpaces, ' ');
            res.append(sep);
            res.append(valueStr);
            return res;
        }
        std::string compact = std::string(label) + ":" + std::string(valueStr);
        return pad(compact, width);
    }

    /// Formats an integer parameter with optional unit (e.g. "Cutoff     : 72 Hz").
    static std::string formatParam(std::string_view label, int value, std::string_view unit = "", int width = kDefaultWidth16)
    {
        char valBuf[32];
        if (unit.empty())
            std::snprintf(valBuf, sizeof(valBuf), "%d", value);
        else
            std::snprintf(valBuf, sizeof(valBuf), "%d %.*s", value, static_cast<int>(unit.length()), unit.data());
        return formatParamLine(label, valBuf, width);
    }

    /// Formats a signed integer parameter with explicit '+' (e.g. "Pitch      : +2 st", "Pan        : -12").
    static std::string formatSigned(std::string_view label, int value, std::string_view unit = "", int width = kDefaultWidth16)
    {
        char valBuf[32];
        const char sign = (value > 0) ? '+' : '\0';
        if (unit.empty())
        {
            if (sign != '\0')
                std::snprintf(valBuf, sizeof(valBuf), "+%d", value);
            else
                std::snprintf(valBuf, sizeof(valBuf), "%d", value);
        }
        else
        {
            if (sign != '\0')
                std::snprintf(valBuf, sizeof(valBuf), "+%d %.*s", value, static_cast<int>(unit.length()), unit.data());
            else
                std::snprintf(valBuf, sizeof(valBuf), "%d %.*s", value, static_cast<int>(unit.length()), unit.data());
        }
        return formatParamLine(label, valBuf, width);
    }

    /// Formats a floating-point parameter with specified decimal places (e.g. "Rate       : 2.40 Hz").
    static std::string formatFloat(std::string_view label, float value, int decimals = 2, std::string_view unit = "", int width = kDefaultWidth16)
    {
        char valBuf[32];
        const int dec = std::clamp(decimals, 0, 4);
        if (unit.empty())
            std::snprintf(valBuf, sizeof(valBuf), "%.*f", dec, static_cast<double>(value));
        else
            std::snprintf(valBuf, sizeof(valBuf), "%.*f %.*s", dec, static_cast<double>(value), static_cast<int>(unit.length()), unit.data());
        return formatParamLine(label, valBuf, width);
    }

    /// Formats a discrete choice parameter from an injected list of names (e.g. "Wave       : SAW").
    static std::string formatChoice(std::string_view label, int choiceIndex, std::span<const char* const> choices, int width = kDefaultWidth16)
    {
        std::string_view choiceStr = "---";
        if (choiceIndex >= 0 && choiceIndex < static_cast<int>(choices.size()) && choices[static_cast<size_t>(choiceIndex)] != nullptr)
        {
            choiceStr = choices[static_cast<size_t>(choiceIndex)];
        }
        return formatParamLine(label, choiceStr, width);
    }

    /// Formats an ASCII bargraph meter for LCD displays (e.g. "Level [====    ]").
    static std::string formatBargraph(std::string_view label, float norm01, int barWidth = 8, int width = kDefaultWidth16)
    {
        const int bw = std::clamp(barWidth, 4, 12);
        const float cNorm = std::clamp(norm01, 0.0f, 1.0f);
        const int filled = static_cast<int>(std::round(cNorm * static_cast<float>(bw)));
        std::string bar = "[";
        bar.append(static_cast<size_t>(filled), '=');
        bar.append(static_cast<size_t>(bw - filled), ' ');
        bar.push_back(']');
        return formatParamLine(label, bar, width);
    }

    /// Formats a standard 2-line parameter edit screen (Line 1: Page header, Line 2: Param line).
    static LcdScreenLines formatParameterScreen(std::string_view pageHeader, std::string_view paramLine, int width = kDefaultWidth16)
    {
        return { pad(pageHeader, width), pad(paramLine, width) };
    }
};

// Aliases for retrocompatibility across existing projects.
using LCDMenuFormatter = LcdTextFormatter;
using LCDScreenText = LcdScreenLines;

} // namespace abd::synth

namespace abdsynth::core
{
    using LcdTextFormatter = abd::synth::LcdTextFormatter;
    using LcdScreenLines = abd::synth::LcdScreenLines;
    using LCDMenuFormatter = abd::synth::LCDMenuFormatter;
    using LCDScreenText = abd::synth::LCDScreenText;
} // namespace abdsynth::core

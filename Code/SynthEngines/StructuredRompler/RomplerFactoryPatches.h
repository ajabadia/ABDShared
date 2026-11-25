#pragma once

#include "RomplerTypes.h"
#include "StructuredRomplerEngine.h"

namespace abd::rompler
{

/**
 * @brief Out-of-the-box factory tones and drum kits for StructuredRomplerEngine.
 */
class RomplerFactoryPatches
{
public:
    static constexpr int kNumFactoryKits = 4;
    static constexpr int kNumFactoryTones = 16;
    static constexpr int kNumJv880FactoryTones = 64;

    static void initFactoryDrumKit(RomplerPatch& patch, RomplerDrumKitPatch& drumKit, int kitIndex = 0) noexcept;
    static void initFactoryTone(RomplerPatch& patch, int toneIndex) noexcept;

    static void applyFactoryDrumKit(StructuredRomplerEngine& engine, int kitIndex = 0) noexcept;
    static void applyFactoryTone(StructuredRomplerEngine& engine, int toneIndex) noexcept;
    static void applyJv880FactoryTone(StructuredRomplerEngine& engine, int toneIndex) noexcept;

    [[nodiscard]] static const char* getKitName(int index) noexcept;
    [[nodiscard]] static const char* getToneName(int index) noexcept;
    [[nodiscard]] static const char* getJv880ToneName(int index) noexcept;
    [[nodiscard]] static int getJv880ToneCategory(int index) noexcept;
};

} // namespace abd::rompler

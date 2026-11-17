#pragma once

#include <vector>
#include <array>
#include <cstdint>
#include <algorithm>

namespace abdsynth::core {

/// Evento de animación o reproducción vectorial de joystick (compatible con sound.stickrec)
struct StickRecEvent {
    uint16_t time{0};     ///< Marca de tiempo monotónica en ticks/ms (0x0000..0xFFFF)
    uint8_t  flag{0};     ///< Flag de transición/borde (4 bits, 0 o 1)
    uint8_t  control{0};  ///< Identificador de stick/eje (4 bits, 0..7)
    uint16_t value{0};    ///< Valor 12-bit de posición (0x000..0xFFF, 0x200 = centro 512)
};

/// Motor de reproducción determinista de trayectorias vectoriales en tiempo real
class StickPlayer {
public:
    StickPlayer() = default;

    /// Inicializa la frecuencia de muestreo
    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    /// Reinicia la posición temporal
    void reset() noexcept {
        playbackTimeMs_ = 0.0;
        currentEventIndex_ = 0;
        isPlaying_ = false;
    }

    /// Carga los eventos de una trayectoria
    void loadEvents(const std::vector<StickRecEvent>& events) {
        events_ = events;
        reset();
    }

    /// Dispara la reproducción desde t = 0
    void trigger() noexcept {
        if (events_.empty()) return;
        playbackTimeMs_ = 0.0;
        currentEventIndex_ = 0;
        isPlaying_ = true;
    }

    /// Detiene la reproducción
    void stop() noexcept {
        isPlaying_ = false;
    }

    [[nodiscard]] bool isPlaying() const noexcept { return isPlaying_; }
    [[nodiscard]] bool hasEvents() const noexcept { return !events_.empty(); }
    [[nodiscard]] size_t getEventCount() const noexcept { return events_.size(); }

    /// Configura el mapeo de los 8 controles a índices de parámetros del sintetizador
    void setControlMapping(const std::array<uint32_t, 8>& mapping) noexcept {
        controlParamMap_ = mapping;
    }

    void setParamIndexForControl(uint8_t control, uint32_t paramIndex) noexcept {
        if (control < 8) {
            controlParamMap_[control] = paramIndex;
        }
    }

    [[nodiscard]] uint32_t getParamIndexForControl(uint8_t control) const noexcept {
        return control < 8 ? controlParamMap_[control] : 0;
    }

    /// Procesa un bloque de audio de numSamples muestras y despacha los cambios de stick
    template <typename Callback>
    void processBlock(size_t numSamples, Callback&& onParamUpdate) {
        if (!isPlaying_ || events_.empty()) return;

        double blockDurationMs = (static_cast<double>(numSamples) * 1000.0) / sampleRate_;
        playbackTimeMs_ += blockDurationMs;

        while (currentEventIndex_ < events_.size()) {
            const auto& evt = events_[currentEventIndex_];
            if (static_cast<double>(evt.time) <= playbackTimeMs_) {
                if (evt.control < 8) {
                    uint32_t pIdx = controlParamMap_[evt.control];
                    // Valor en stickrec es 0x000..0x200 (0..512). Normalizado 0.0..1.0
                    float norm = std::clamp(static_cast<float>(evt.value) / 512.0f, 0.0f, 1.0f);
                    float raw = norm * 127.0f;
                    onParamUpdate(pIdx, raw);
                }
                currentEventIndex_++;
            } else {
                break;
            }
        }

        if (currentEventIndex_ >= events_.size()) {
            if (loopMode_) {
                playbackTimeMs_ = 0.0;
                currentEventIndex_ = 0;
            } else {
                isPlaying_ = false;
            }
        }
    }

    void setLoop(bool loop) noexcept { loopMode_ = loop; }
    [[nodiscard]] bool getLoop() const noexcept { return loopMode_; }

private:
    double sampleRate_{44100.0};
    double playbackTimeMs_{0.0};
    size_t currentEventIndex_{0};
    bool isPlaying_{false};
    bool loopMode_{false};
    std::array<uint32_t, 8> controlParamMap_{0, 1, 2, 3, 4, 5, 6, 7};
    std::vector<StickRecEvent> events_;
};

} // namespace abdsynth::core

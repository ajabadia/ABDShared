// ─────────────────────────── EnvelopeAnalog ───────────────────────────
//
// La envolvente ADSR analógica compartida (abd::synth::EnvelopeAnalog) — NO
// confundir con ADSREnvelope.h (la clásica, ya cubierta por testEnvelope()).
// Esta es la de DeepMind: 4 fases con Stage explícito, curvatura ajustable
// por etapa en [−1,+1], modulación de curva por matriz, sustain con offset,
// loopMode y bypassSustain. Lo que se fija aquí:
//
//  - El ciclo de fases kIdle → kAttack → kDecay → kSustain → kRelease →
//    kIdle con sus duraciones (~10 ms por fase a 44,1 kHz con 0,01 s), el
//    ataque monótono y el sustain plano en el nivel pedido con curva 0.
//  - Las 4 transiciones con sus políticas: por defecto decay → sustain;
//    loopMode re-ataca tras el decay; bypassSustain salta al release.
//  - setTimeScale: la implementación divide el incremento por el escala, así
//    que escala 0,5 ACORTA la fase (la cabecera dice lo contrario para >1;
//    aquí se fija el comportamiento REAL para que una divergencia salte).
//  - La curvatura: en el punto medio del ataque, curva −1 sube rápido con
//    la forma RC (1−(1−p)^4 ≈ 0,94), curva 0 es lineal y curva +1 sube lento
//    (p^0,25 invertido: p^4 ≈ 0,06); setCurves
//    clampea a [−1,+1] y la modulación de matriz se SUMA a la curva base.
//  - El sustain con curva +1 sube hacia 1,0 y la negativa baja hacia 0 y se
//    clava ahí, con la pendiente calibrada contra el DM12: no depende del
//    tiempo de Decay y se divide por timeScale. sustainEfectivo() aplica el
//    offset clampeado a [0,1].
//
// Este .inc se incluye DENTRO de `namespace abd::synth::tests` (lo abre
// SynthCoreTests.cpp): NO abre namespace propio ni incluye cabeceras de std.
// EnvelopeAnalog.h se incluye arriba, FUERA del namespace.

using EnvStage = abd::synth::EnvelopeAnalog::Stage;

// Dispara la envolvente con los parámetros estándar y devuelve la etapa
// tras k muestras. 0,01 s por fase a 44,1 kHz = ~441 muestras por fase.
static EnvStage etapaTras(bool loop, bool bypass, float timeScale, int k)
{
    abd::synth::EnvelopeAnalog e;
    e.setSampleRate(44100.0);
    e.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
    e.setCurves(0.0f, 0.0f, 0.0f, 0.0f);
    e.setLoopMode(loop);
    e.setBypassSustain(bypass);
    if (timeScale != 1.0f) e.setTimeScale(timeScale);
    e.trigger();
    for (int i = 0; i < k; ++i) e.nextSample();
    return e.getCurrentStage();
}

// Nivel del ataque tras k muestras con la curva de ataque dada.
static float nivelAtaqueConCurva(float curva, int k)
{
    abd::synth::EnvelopeAnalog e;
    e.setSampleRate(44100.0);
    e.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
    e.setCurves(curva, 0.0f, 0.0f, 0.0f);
    e.trigger();
    float v = 0.0f;
    for (int i = 0; i < k; ++i) v = e.nextSample();
    return v;
}

// Nivel del sustain tras k muestras desde que empieza la fase.
static float nivelSustainConCurva(float curva, int k, float timeScale = 1.0f)
{
    abd::synth::EnvelopeAnalog e;
    e.setSampleRate(44100.0);
    e.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
    e.setCurves(0.0f, 0.0f, curva, 0.0f);
    if (timeScale != 1.0f) e.setTimeScale(timeScale);
    e.trigger();
    while (e.getCurrentStage() != EnvStage::kSustain)
        e.nextSample();

    for (int i = 0; i < k; ++i) e.nextSample();
    return e.getCurrentLevel();
}

// Incremento de nivel durante `muestras` muestras de sustain, medido desde
// que arranca la fase. Es la pendiente del sustain (paso constante por
// muestra), con el tiempo de Decay y la escala de tiempo que se pidan.
static float pendienteSustain(float curva, float decaySec, float timeScale, int muestras)
{
    abd::synth::EnvelopeAnalog e;
    e.setSampleRate(44100.0);
    e.setParameters(0.01f, decaySec, 0.5f, 0.01f);
    e.setCurves(0.0f, 0.0f, curva, 0.0f);
    if (timeScale != 1.0f) e.setTimeScale(timeScale);
    e.trigger();
    while (e.getCurrentStage() != EnvStage::kSustain)
        e.nextSample();

    const float inicio = e.getCurrentLevel();
    for (int i = 0; i < muestras; ++i) e.nextSample();
    return e.getCurrentLevel() - inicio;
}

static void testEnvelopeAnalogPhases()
{
    printf("=== EnvelopeAnalog: las 4 fases ADSR ===\n");

    {
        abd::synth::EnvelopeAnalog e;
        e.setSampleRate(44100.0);
        e.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
        e.setCurves(0.0f, 0.0f, 0.0f, 0.0f);

        check(!e.isActive() && e.getCurrentStage() == EnvStage::kIdle,
              "arranca en reposo (kIdle)");
        check(e.nextSample() == 0.0f, "en reposo devuelve 0");

        e.trigger();
        check(e.getCurrentStage() == EnvStage::kAttack, "trigger() entra en ataque");

        bool mono = true, rango = true;
        float prev = -1.0f;
        for (int i = 0; i < 500; ++i)
        {
            const float v = e.nextSample();
            if (v < prev) mono = false;
            if (v < -0.001f || v > 1.001f) rango = false;
            prev = v;
            // Solo se mide el ATAQUE: en cuanto la etapa cambia a decay la
            // curva ya baja a propósito, y eso no es no-monotonicidad.
            if (e.getCurrentStage() != EnvStage::kAttack) break;
        }
        check(mono, "el ataque es monótono creciente");
        check(rango, "y se queda dentro de [0,1]");
        check(e.getCurrentStage() == EnvStage::kDecay,
              "tras ~10 ms el ataque termina y pasa a decay");

        for (int i = 0; i < 500; ++i) e.nextSample();
        check(e.getCurrentStage() == EnvStage::kSustain,
              "tras otros ~10 ms entra en sustain");
        check(std::abs(e.getCurrentLevel() - 0.5f) < 0.001f,
              "el sustain se clava en 0,5 (curva plana, sin offset)");

        e.release();
        check(e.getCurrentStage() == EnvStage::kRelease, "release() entra en release");
        for (int i = 0; i < 500; ++i) e.nextSample();
        check(!e.isActive() && e.getCurrentStage() == EnvStage::kIdle,
              "acabado el release vuelve a kIdle");
        check(e.nextSample() == 0.0f, "tras el release la salida es 0");
    }

    // ── Las tres transiciones con política ──
    check(etapaTras(false, false, 1.0f, 950) == EnvStage::kSustain,
          "por defecto: decay → sustain");
    check(etapaTras(true, false, 1.0f, 950) == EnvStage::kAttack,
          "loopMode: tras el decay re-ataca (sin pasar por sustain)");
    check(etapaTras(false, true, 1.0f, 950) == EnvStage::kRelease,
          "bypassSustain: salta directo al release (one-shot)");

    // ── setTimeScale: escala 0,5 acorta la fase (comportamiento real) ──
    check(etapaTras(false, false, 1.0f, 300) == EnvStage::kAttack,
          "a escala normal, a las 300 muestras aún está atacando");
    check(etapaTras(false, false, 0.5f, 300) == EnvStage::kDecay,
          "timeScale 0,5 duplica la velocidad: en 300 muestras ya hace decay");
}

static void testEnvelopeAnalogCurves()
{
    printf("=== EnvelopeAnalog: curvatura [-1,+1] ===\n");

    // ── Curvatura del ataque en el punto medio (p ≈ 0,499 en la muestra 220) ──
    const float mNeg  = nivelAtaqueConCurva(-1.0f, 220); // RC 1−(1−p)^4: sube rápido
    const float mCero = nivelAtaqueConCurva(0.0f, 220);  // lineal
    const float mPos  = nivelAtaqueConCurva(1.0f, 220);  // exponente 4: sube lento

    check(mNeg > 0.7f, "curva −1: subida rápida (RC, ≈ 0,94) en el punto medio");
    check(mCero > 0.45f && mCero < 0.55f, "curva 0: lineal en el punto medio");
    check(mPos < 0.15f, "curva +1: subida lenta (≈ p^4) en el punto medio");
    check(mNeg > mCero && mCero > mPos,
          "las tres curvas están ordenadas y son distintas (curvatura no lineal)");

    // ── setCurves clampea a [−1,+1]: (99,−99,50,−50) se comporta como (1,−1,1,−1) ──
    {
        abd::synth::EnvelopeAnalog a, b;
        a.setSampleRate(44100.0);
        a.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
        a.setCurves(99.0f, -99.0f, 50.0f, -50.0f);
        a.trigger();
        b.setSampleRate(44100.0);
        b.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
        b.setCurves(1.0f, -1.0f, 1.0f, -1.0f);
        b.trigger();

        bool identico = true;
        for (int i = 0; i < 1500; ++i)
            if (a.nextSample() != b.nextSample()) identico = false;
        check(identico, "setCurves clampea a [−1,+1]: fuera de rango = tope");
    }

    // ── La modulación de matriz se SUMA a la curva base (y también clampea) ──
    {
        abd::synth::EnvelopeAnalog a, b;
        a.setSampleRate(44100.0);
        a.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
        a.setCurves(0.0f, 0.0f, 0.0f, 0.0f);
        a.setCurveModulation(EnvStage::kAttack, 99.0f); // clampeado a +1
        a.trigger();
        b.setSampleRate(44100.0);
        b.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
        b.setCurves(1.0f, 0.0f, 0.0f, 0.0f); // curva base +1
        b.trigger();

        bool identico = true;
        for (int i = 0; i < 1500; ++i)
            if (a.nextSample() != b.nextSample()) identico = false;
        check(identico, "la modulación de curva se suma a la base y clampea igual");
    }

    // ── Sustain: +1 sube hasta 1,0; 0 se queda plano ──
    {
        const float sustain0     = nivelSustainConCurva(0.0f, 4410);  // 100 ms
        const float sustain0Long = nivelSustainConCurva(0.0f, 22050); // 500 ms
        const float sustain100   = nivelSustainConCurva(1.0f, 4410);  // 100 ms
        const float sustain500   = nivelSustainConCurva(1.0f, 22050); // 500 ms

        check(std::abs(sustain0 - 0.5f) < 1.0e-6f,
              "sustain con curva 0 se queda clavado en 0,5");
        check(std::abs(sustain0Long - 0.5f) < 1.0e-6f,
              "y sigue plano a los 500 ms (no deriva con el tiempo)");
        check(sustain100 > 0.78f && sustain100 < 0.84f,
              "sustain con curva +1 sube ~0,81 en 100 ms");
        check(sustain500 > 0.999f,
              "sustain con curva +1 alcanza 1,0 antes de 500 ms");
    }

    // ── Sustain con curva negativa: baja hacia 0 y se clava ahí ──
    {
        const float neg100   = nivelSustainConCurva(-1.0f, 4410);      // 100 ms
        const float negLargo = nivelSustainConCurva(-1.0f, 132300);    // 3 s

        check(neg100 > 0.17f && neg100 < 0.21f && negLargo == 0.0f,
              "sustain con curva −1 baja hacia 0 (~0,19 en 100 ms) y no pasa de largo");
    }

    // ── La pendiente no depende del tiempo de Decay (calibración DM12) ──
    {
        const float pendCorta = pendienteSustain(1.0f, 0.01f, 1.0f, 441); // Decay 10 ms
        const float pendLarga = pendienteSustain(1.0f, 0.50f, 1.0f, 441); // Decay 500 ms

        check(std::abs(pendCorta - pendLarga) < 1.0e-5f,
              "la pendiente del sustain es independiente del tiempo de Decay");
    }

    // ── timeScale divide la pendiente: 0,5 la duplica y 2,0 la reduce a la mitad ──
    {
        const float pendNormal = pendienteSustain(1.0f, 0.01f, 1.0f, 441);
        const float pendRapida = pendienteSustain(1.0f, 0.01f, 2.0f, 441);
        const float pendLenta  = pendienteSustain(1.0f, 0.01f, 0.5f, 441);

        // Se compara la razón, no la diferencia: la acumulación en float de
        // 441 pasos ya introduce ~1e-5 de ruido sobre un paso de 7e-5.
        const float razonLenta  = pendLenta / pendNormal;
        const float razonRapida = pendRapida / pendNormal;
        check(std::abs(razonLenta - 2.0f) < 0.01f && std::abs(razonRapida - 0.5f) < 0.01f,
                            "timeScale divide la pendiente del sustain (0,5 la duplica, 2,0 la reduce a la mitad)");
    }

    // ── setTimeScale: la pendiente del sustain se divide por la escala ──
    {
        // La pendiente del sustain es un paso constante por muestra, así que a
        // escala 0,5 el doble de rápido significa que 50 ms rinden lo mismo que
        // 100 ms a escala 1 (y el nivel no es el plano: la prueba anterior ya
        // fija que curva +1 sube ~0,81 en esos 100 ms).
        const float lento  = nivelSustainConCurva(1.0f, 4410, 1.0f);
        const float rapido = nivelSustainConCurva(1.0f, 2205, 0.5f);
        check(std::abs(lento - rapido) < 1.0e-4f,
              "timeScale 0,5 duplica la pendiente del sustain (50 ms = 100 ms a escala 1)");
    }

    // ── sustainEfectivo: offset sumado y clampeado a [0,1] ──
    {
        abd::synth::EnvelopeAnalog e;
        e.setParameters(0.01f, 0.01f, 0.5f, 0.01f);
        e.setSustainOffset(0.5f);
        check(e.sustainEfectivo() == 1.0f, "sustain 0,5 + offset 0,5 = 1,0");
        e.setSustainOffset(0.6f);
        check(e.sustainEfectivo() == 1.0f, "el offset se clampea: no pasa de 1,0");
        e.setSustainOffset(-0.8f);
        check(e.sustainEfectivo() == 0.0f, "ni baja de 0,0");
    }
}

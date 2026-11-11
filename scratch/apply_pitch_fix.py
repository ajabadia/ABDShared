"""Aplica la validacion de octava del tracker de pitch y el modo --rescore."""
import io

A = "scripts/calibration/preset_ab_analyzer.py"
B = "scripts/calibration/factory_presets_ab_suite.py"


def rw(path, fn):
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        s = f.read()
    crlf = "\r\n" in s
    sn = s.replace("\r\n", "\n")
    out = fn(sn)
    assert out != sn, "sin cambios en " + path
    if crlf:
        out = out.replace("\n", "\r\n")
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(out)
    print("OK", path)


def rep(s, old, new, path):
    n = s.count(old)
    assert n == 1, "%s: %d ocurrencias de %r" % (path, n, old[:70])
    return s.replace(old, new)


def patch_analyzer(s):
    # 1. Validacion de octava dentro del tracker (subarmonico -> fundamental).
    s = rep(s, """    lag = min_lag + chosen_rel
    # Parabolic interpolation""", """    lag = min_lag + chosen_rel
    # Validacion de octava del tracker: si el lag mitad sigue siendo casi tan
    # periodico como el elegido, el pico escogido es el subarmonico de un tono
    # que si repite a mitad de periodo, y la fundamental real esta una octava
    # arriba. Se corrige antes de interpolar (maximo 2 octavas).
    for _ in range(2):
        half = lag // 2
        if half >= min_lag and acf[half] >= 0.90 * acf[lag]:
            lag = half
        else:
            break
    # Parabolic interpolation""", A)

    # 2. Helper de energia espectral en banda.
    s = rep(s, """def analyze_preset_pair(""", '''def _band_energy_share(freqs: np.ndarray, psd: np.ndarray, hz: float, half_frac: float = 0.05) -> float:
    """Fraccion de energia en +-half_frac alrededor de hz, relativa a la banda audible (35..15k)."""
    if hz <= 0.0:
        return 0.0
    lo, hi = hz * (1.0 - half_frac), hz * (1.0 + half_frac)
    band = (freqs >= lo) & (freqs <= hi)
    total = float(np.sum(psd[(freqs >= 35.0) & (freqs <= 15000.0)])) + 1e-18
    return float(np.sum(psd[band])) / total


def analyze_preset_pair(''', A)

    # 3. Campos nuevos del dataclass.
    s = rep(s, """    pitch_err_cents: float
    pitch_confident: bool""", """    pitch_err_cents: float       # error final (plegado solo si el plegado se valido)
    pitch_raw_err_cents: float   # error crudo del tracker, sin plegar
    pitch_octave_shift: int      # octavas descontadas por un plegado validado
    pitch_octave_validated: bool # el plegado tiene respaldo espectral y de rango
    pitch_confident: bool""", A)

    # 4. Constructor de tomas silenciosas.
    s = rep(s, """            hw_f0_hz=0.0, sw_f0_hz=0.0, pitch_err_cents=0.0, pitch_confident=False,""", """            hw_f0_hz=0.0, sw_f0_hz=0.0, pitch_err_cents=0.0,
            pitch_raw_err_cents=0.0, pitch_octave_shift=0, pitch_octave_validated=False,
            pitch_confident=False,""", A)

    # 5. Plegado con validacion.
    s = rep(s, """    if pitch_confident:
        # Plegado de octavas: compensa subarmonicos/armonicos espurios del tracker de f0
        ratio = hw_f0 / sw_f0
        oct_diff = round(math.log2(ratio))
        ratio_folded = ratio / (2.0 ** oct_diff)
        pitch_err_cents = 1200.0 * math.log2(ratio_folded)
    else:
        pitch_err_cents = 0.0""", """    pitch_raw_err_cents = 0.0
    pitch_octave_shift = 0
    pitch_octave_validated = False
    if pitch_confident:
        ratio = hw_f0 / sw_f0
        pitch_raw_err_cents = 1200.0 * math.log2(ratio)
        oct_diff = int(round(math.log2(ratio)))
        ratio_folded = ratio / (2.0 ** oct_diff)
        cents_folded = 1200.0 * math.log2(ratio_folded)
        common_hz = sw_f0 * (2.0 ** oct_diff)

        # Validacion de octava. Un plegado solo se acepta si:
        #   (a) la distancia es una confusion de octava plausible dentro del rango
        #       util del tracker (28..2200 Hz) y no una fantasia de armonicos lejanos;
        #   (b) tras descontarla el tono queda afinado dentro de 50 cents: un residuo
        #       mayor no es una octava mal contada, es otra nota;
        #   (c) la fundamental comun tiene energia espectral real en AMBAS capturas.
        # Si algo falla NO se maquilla el error: se reporta el crudo y se marca.
        in_range = bool(abs(oct_diff) <= 3 and 25.0 <= common_hz <= 2200.0)
        residual_ok = bool(abs(cents_folded) <= 50.0)
        spectral_ok = bool(_band_energy_share(f_hw, psd_hw, common_hz) >= 1e-4
                           and _band_energy_share(f_sw, psd_sw, common_hz) >= 1e-4)
        pitch_octave_validated = bool(in_range and residual_ok and spectral_ok)
        if pitch_octave_validated:
            pitch_err_cents = cents_folded
            pitch_octave_shift = oct_diff
        else:
            pitch_err_cents = pitch_raw_err_cents
    else:
        pitch_err_cents = 0.0""", A)

    # 6. Tags explicitos.
    s = rep(s, """    if pitch_confident and abs(pitch_err_cents) > 35.0:
        tags.append(f"PITCH_DIFF({pitch_err_cents:+.0f}c)")""", """    if pitch_confident and not pitch_octave_validated:
        tags.append(f"PITCH_OCTAVE_UNVALIDATED({pitch_raw_err_cents:+.0f}c)")
    elif pitch_confident:
        if pitch_octave_shift != 0:
            tags.append(f"PITCH_OCTAVE_FOLDED({pitch_octave_shift:+d}oct)")
        if abs(pitch_err_cents) > 35.0:
            tags.append(f"PITCH_DIFF({pitch_err_cents:+.0f}c)")""", A)

    # 7. Constructor del resultado.
    s = rep(s, """        pitch_err_cents=pitch_err_cents,
        pitch_confident=pitch_confident,""", """        pitch_err_cents=pitch_err_cents,
        pitch_raw_err_cents=pitch_raw_err_cents,
        pitch_octave_shift=pitch_octave_shift,
        pitch_octave_validated=pitch_octave_validated,
        pitch_confident=pitch_confident,""", A)
    return s


RESCORE = '''def cmd_rescore(args: argparse.Namespace) -> int:
    """Re-scores an existing session's captured WAVs with the current analyzer (no HW, no re-render)."""
    session_dir = args.session_dir
    if not session_dir:
        if os.path.isfile(LATEST_PTR_FILE):
            session_dir = open(LATEST_PTR_FILE, "r", encoding="utf-8").read().strip()
        else:
            print("[ERROR] No --session-dir provided and no latest session pointer found.")
            return 1

    manifest_path = os.path.join(session_dir, "session_manifest.json")
    if not os.path.isfile(manifest_path):
        print(f"[ERROR] session_manifest.json not found in {session_dir}")
        return 1

    manifest = json.load(open(manifest_path, "r", encoding="utf-8"))
    sr = int(manifest["sample_rate"])
    pre_roll_sec = float(manifest.get("pre_roll_sec", 0.22))
    stimuli = manifest["stimuli"]
    prev_results = manifest.get("results", [])
    prev_mean = float(np.mean([r["parity_score"] for r in prev_results if r.get("status") != "silent"])) if prev_results else 0.0

    hw_dir = os.path.join(session_dir, "wav_hw")
    sw_dir = os.path.join(session_dir, "wav_sw")
    hw_anchor_wav = os.path.join(hw_dir, "ANCHOR_INIT_SAW.wav")
    sw_anchor_wav = os.path.join(sw_dir, "ANCHOR_INIT_SAW.wav")
    if not (os.path.isfile(hw_anchor_wav) and os.path.isfile(sw_anchor_wav)):
        print("[ERROR] Anchor WAVs missing (ANCHOR_INIT_SAW.wav in wav_hw/wav_sw).")
        return 1

    hw_anchor_audio, _ = sf.read(hw_anchor_wav)
    sw_anchor_audio, _ = sf.read(sw_anchor_wav)
    anchor = calibrate_anchor_from_pair(sw_anchor_audio, hw_anchor_audio, sr=sr, pre_roll_sec=pre_roll_sec, hold_sec=1.0)

    patches_dir = os.path.join(session_dir, "patches")
    results: List[PointToPointResult] = []
    patch_features_by_id: Dict[str, Dict[str, Any]] = {}
    for p_info in manifest["presets"]:
        pid, pname = p_info["id"], p_info["name"]
        patch_bin = os.path.join(patches_dir, f"{pid}_242.bin")
        if os.path.isfile(patch_bin):
            patch_features_by_id[pid] = extract_patch_features(open(patch_bin, "rb").read())
        for stim in stimuli:
            hw_wav = os.path.join(hw_dir, f"{pid}_{stim['tag']}.wav")
            sw_wav = os.path.join(sw_dir, f"{pid}_{stim['tag']}.wav")
            if not (os.path.isfile(hw_wav) and os.path.isfile(sw_wav)):
                continue
            hw_audio, _ = sf.read(hw_wav)
            sw_audio, _ = sf.read(sw_wav)
            results.append(analyze_preset_pair(
                preset_id=pid, preset_name=pname,
                sw_audio=sw_audio, hw_audio=hw_audio, sr=sr,
                note=stim["note"], velocity=stim["vel"],
                hold_sec=stim["hold"], tail_sec=stim["tail"],
                pre_roll_sec=pre_roll_sec, anchor=anchor,
            ))

    new_mean = float(np.mean([r.parity_score for r in results if r.status != "silent"])) if results else 0.0
    delta = new_mean - prev_mean
    report_md = generate_markdown_report(
        anchor, results, patch_features_by_id,
        title=f"ABDEep Re-Score Report (New: {new_mean:.1f}% vs Baseline: {prev_mean:.1f}%, Delta: {delta:+.1f}%)",
    )
    out_md = os.path.join(session_dir, "REPORT_rescore.md")
    with open(out_md, "w", encoding="utf-8") as f:
        f.write(report_md)
    save_csv_summary(os.path.join(session_dir, "summary_metrics_rescore.csv"), results)

    unvalidated = [r for r in results if r.pitch_confident and not r.pitch_octave_validated]
    folded = [r for r in results if r.pitch_octave_shift != 0]
    print(f"[MEDIA] Baseline {prev_mean:.2f}%  ->  Re-score {new_mean:.2f}%  (Delta {delta:+.2f}%)")
    print(f"[PITCH] plegadas validadas: {len(folded)} | octava no validada: {len(unvalidated)} | "
          f"confiadas: {sum(1 for r in results if r.pitch_confident)}")
    print(f"[REPORT] {out_md}")
    for r in results:
        if r.pitch_confident:
            print(f"  {r.preset_id} n{r.note:<3d} HW={r.hw_f0_hz:8.2f} SW={r.sw_f0_hz:8.2f} "
                  f"raw={r.pitch_raw_err_cents:+8.1f}c shift={r.pitch_octave_shift:+d} "
                  f"valid={str(r.pitch_octave_validated):5s} err={r.pitch_err_cents:+8.1f}c "
                  f"score={r.parity_score:5.1f}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Factory Presets Point-to-Point A/B Suite")'''


def patch_suite(s):
    s = rep(s, '''def main() -> int:
    parser = argparse.ArgumentParser(description="Factory Presets Point-to-Point A/B Suite")''',
            RESCORE, B)
    s = rep(s, '''    parser.add_argument("--rerender-sw", action="store_true", help="Re-render software C++ only against existing HW session")''',
            '''    parser.add_argument("--rerender-sw", action="store_true", help="Re-render software C++ only against existing HW session")
    parser.add_argument("--rescore", action="store_true", help="Re-score already captured WAVs with the current analyzer (no HW, no re-render)")''', B)
    s = rep(s, """    if args.rerender_sw:
        return cmd_rerender_sw(args)""", """    if args.rerender_sw:
        return cmd_rerender_sw(args)
    if args.rescore:
        return cmd_rescore(args)""", B)
    return s


rw(A, patch_analyzer)
rw(B, patch_suite)
print("PARCHES APLICADOS")

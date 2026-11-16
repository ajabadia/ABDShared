import { describe, it, expect } from 'vitest';
import {
  encodeWavPcm16,
  decodeWav,
  extractAudioHeaderInstrumentInfo,
  createZipArchive,
  parseZipArchive,
} from '../Code/NeuronFormats/index.ts';
import {
  importSfzToNative,
  importSf2PresetToNative,
  listSf2Presets,
  exportRawSamplerLibrary,
  buildSoundFont2Archive,
  parseUniversalSamplerInstrument,
  exportUniversalSamplerCapsule,
  renderUniversalSamplerNoteOffline,
  createDefaultArticulation,
} from '../Code/SamplerFormats/index.ts';

function makeSineWav(freqHz, sampleRate = 48000, frames = 4800, inst = undefined) {
  const ch = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    ch[i] = 0.7 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return encodeWavPcm16([ch], sampleRate, inst);
}

function makeStereoWav(leftFreqHz, rightFreqHz, sampleRate = 48000, frames = 4800, inst = undefined) {
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    l[i] = 0.7 * Math.sin((2 * Math.PI * leftFreqHz * i) / sampleRate);
    r[i] = 0.7 * Math.sin((2 * Math.PI * rightFreqHz * i) / sampleRate);
  }
  return encodeWavPcm16([l, r], sampleRate, inst);
}

function patchWavSmplLoopType(wavBuffer, loopType) {
  const copy = wavBuffer.slice(0);
  const view = new DataView(copy);
  let pos = 12;
  while (pos + 8 <= copy.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(pos),
      view.getUint8(pos + 1),
      view.getUint8(pos + 2),
      view.getUint8(pos + 3),
    );
    const sz = view.getUint32(pos + 4, true);
    if (id === 'smpl' && sz >= 60) {
      view.setUint32(pos + 8 + 40, loopType, true);
      break;
    }
    pos += 8 + sz + (sz & 1);
  }
  return copy;
}

function estimateDominantFreqGoertzel(samples, sampleRate, candidateFreqs) {
  let bestFreq = 0;
  let bestPower = -1;
  const start = Math.floor(samples.length * 0.15);
  const end = Math.min(samples.length, start + 4096);
  const n = end - start;
  for (const freq of candidateFreqs) {
    const omega = (2 * Math.PI * freq) / sampleRate;
    const coeff = 2 * Math.cos(omega);
    let q0 = 0;
    let q1 = 0;
    let q2 = 0;
    for (let i = start; i < end; i++) {
      q0 = coeff * q1 - q2 + samples[i];
      q2 = q1;
      q1 = q0;
    }
    const power = (q1 * q1 + q2 * q2 - q1 * q2 * coeff) / Math.max(1, n);
    if (power > bestPower) {
      bestPower = power;
      bestFreq = freq;
    }
  }
  return bestFreq;
}

describe('SamplerFormats clean-room fixes, canonical capsule, and offline verifier', () => {
  it('SFZ: handles #define macros, isolates <curve> v000..v127 without tripping 128-cap, and still blocks quadratic <global> bomb', () => {
    const curveEntries = Array.from({ length: 130 }, (_, i) => `v${String(i).padStart(3, '0')}=${(i / 129).toFixed(4)}`).join(' ');
    const sfz = [
      '#define $ROOT 60',
      '#define $ATK 0.045',
      '<global>volume=-3',
      '<region>sample=piano.wav key=$ROOT ampeg_attack=$ATK ampeg_sustain=0 pitch_keytrack=0',
      `<curve>${curveEntries}`,
    ].join('\n');

    const res = importSfzToNative(sfz, 'macro_curve.sfz', []);
    expect(res.extendedRegions).toHaveLength(1);
    const r0 = res.extendedRegions[0];
    expect(r0.rootKey).toBe(60);
    expect(r0.lowKey).toBe(60);
    expect(r0.highKey).toBe(60);
    expect(r0.volume).toBe(-3);
    expect(r0.pitchKeytrack).toBe(0);
    expect(res.articulation.ampEnv.attackSec).toBeCloseTo(0.045, 3);
    expect(res.articulation.ampEnv.sustainLevel).toBe(0);

    // Quadratic merge bomb in <global> (>128 opcodes) still fails fast
    const manyOps = Array.from({ length: 200 }, (_, i) => `k${i}=1`).join(' ');
    const bombSfz = `<global>${manyOps}\n<region>sample=a.wav key=60`;
    expect(() => importSfzToNative(bombSfz, 'bomb.sfz', [])).toThrow(/exceeds cap/);
  });

  it('SFZ: resolves <control> default_path + octave_offset + subfolder collisions while preserving flat sampleName (no / or ..)', () => {
    const w1 = makeSineWav(440);
    const w2 = makeSineWav(880);
    const sfz = [
      '<control>',
      'default_path=Samples\\',
      'octave_offset=1',
      '<region>sample=RR1\\C4.wav key=c4',
      '<region>sample=RR2\\C4.wav key=60',
      '<region>sample=../../../../etc/evil.wav key=48',
    ].join('\n');

    const res = importSfzToNative(sfz, 'subfolders.sfz', [
      { name: 'Samples/RR1/C4.wav', buffer: w1 },
      { name: 'Samples/RR2/C4.wav', buffer: w2 },
    ]);

    expect(res.extendedRegions).toHaveLength(3);
    // Traversal remains safe flat basename
    const evilReg = res.extendedRegions.find((r) => r.rootKey === 60); // 48 + 12 octave_offset
    expect(evilReg?.sampleName).toBe('evil.wav');
    expect(evilReg?.sampleName).not.toContain('..');
    expect(evilReg?.sampleName).not.toContain('/');

    const rrRegions = res.extendedRegions.filter((r) => r.rootKey === 72); // c4(60)+12 and 60+12
    expect(rrRegions).toHaveLength(2);
    expect(rrRegions[0].sampleName).not.toBe(rrRegions[1].sampleName);
    for (const r of res.extendedRegions) {
      expect(r.sampleName).not.toContain('/');
      expect(r.sampleName).not.toContain('\\');
      expect(r.sampleName).not.toContain('..');
    }
    const audioByName = new Map(res.audioFiles.map((f) => [f.name, f.buffer]));
    expect(audioByName.get(rrRegions[0].sampleName)?.byteLength).toBeGreaterThan(0);
    expect(audioByName.get(rrRegions[1].sampleName)?.byteLength).toBeGreaterThan(0);
  });

  it('SFZ: sequential key= precedes/overrides group lokey/hikey, skips lovel=0 hivel=0 & hikey=-1, fixes crossfades, inherits WAV smpl metadata, and tracks per-region overrides', () => {
    const wavWithPingPong = patchWavSmplLoopType(
      makeSineWav(440, 48000, 2400, { rootKey: 67, detune: 12, loopStart: 100, loopEnd: 1200 }),
      1, // dwType = 1 (ping_pong)
    );
    const hdr = extractAudioHeaderInstrumentInfo(wavWithPingPong);
    expect(hdr?.rootKey).toBe(67);
    expect(hdr?.loopStart).toBe(100);
    expect(hdr?.loopEnd).toBe(1200);
    expect(hdr?.loopMode).toBe('ping_pong');

    const sfz = [
      '<global>ampeg_attack=0.010 cutoff=4000 fil_type=lpf_2p',
      '<group>lokey=36 hikey=72',
      '<region>sample=ping.wav key=60 xfin_hikey=64 xfout_lokey=68',
      '<region>sample=ping.wav lokey=40 hikey=50 ampeg_attack=0.250 cutoff=900',
      '<region>sample=ping.wav lovel=0 hivel=0 key=70',
      '<region>sample=ping.wav hikey=-1 key=71',
    ].join('\n');

    const res = importSfzToNative(sfz, 'precedence.sfz', [{ name: 'ping.wav', buffer: wavWithPingPong }]);
    // Disabled CC-only regions (lovel=0 hivel=0, hikey=-1) skipped
    expect(res.extendedRegions).toHaveLength(2);

    const keyReg = res.extendedRegions.find((r) => r.rootKey === 60);
    expect(keyReg).toBeDefined();
    expect(keyReg.keyFadeIn).toBe(64); // 64 - 0 when xfin_lokey omitted
    expect(keyReg.keyFadeOut).toBe(59); // 127 - 68 when xfout_hikey omitted
    expect(keyReg.loopMode).toBe('ping_pong');
    expect(keyReg.loopStart).toBe(100);
    expect(keyReg.loopEnd).toBe(1200);

    const overrideReg = res.extendedRegions.find((r) => r.lowKey === 40);
    expect(overrideReg).toBeDefined();
    expect(overrideReg.rootKey).toBe(67); // inherited from WAV smpl chunk
    expect(overrideReg.detune).toBe(12);
    expect(overrideReg.keyFadeIn).toBe(0);
    expect(overrideReg.keyFadeOut).toBe(0);
    expect(overrideReg.hasArticulationOverride).toBe(true);
    expect(overrideReg.ampEnvOverride?.attackSec).toBeCloseTo(0.25, 3);
    expect(overrideReg.filterOverride?.cutoffHz).toBe(900);
  });

  it('SF2: roundtrips stereo pairs, loop_sustain / no_loop, initialAttenuation, and blocks malformed S6.4 bounds', () => {
    const stereoWav = makeStereoWav(440, 880, 48000, 4800);
    const monoWav = makeSineWav(330, 48000, 4800);

    const art = createDefaultArticulation();
    art.ampEnvEnabled = true;
    art.ampEnv.attackSec = 0.02;

    const session = {
      id: 'sf2-roundtrip-test',
      name: 'StereoSus',
      zones: [],
      extendedRegions: [
        {
          id: 'r-stereo',
          sampleName: 'pad_st.wav',
          lowKey: 48,
          highKey: 72,
          rootKey: 60,
          lowVel: 1,
          highVel: 127,
          detune: 0,
          volume: -6,
          pan: 0,
          pitchKeytrack: 100,
          trigger: 'attack',
          keyFadeIn: 0,
          keyFadeOut: 0,
          velFadeIn: 0,
          velFadeOut: 0,
          fadeCurve: 'equal-power',
          loopMode: 'loop_sustain',
          loopStart: 200,
          loopEnd: 2400,
          loopCrossfadeMs: 0,
        },
        {
          id: 'r-noloop',
          sampleName: 'hit_mono.wav',
          lowKey: 24,
          highKey: 36,
          rootKey: 36,
          lowVel: 1,
          highVel: 127,
          detune: 0,
          volume: 0,
          pan: 0,
          pitchKeytrack: 100,
          trigger: 'attack',
          keyFadeIn: 0,
          keyFadeOut: 0,
          velFadeIn: 0,
          velFadeOut: 0,
          fadeCurve: 'equal-power',
          loopMode: 'no_loop',
          loopStart: 0,
          loopEnd: 0,
          loopCrossfadeMs: 0,
        },
      ],
      articulation: art,
      processConfig: {
        modelNumber: 0,
        modelName: 'StereoSus',
        expandedName: 'StereoSus',
        complexity: 8,
        parameterSet: 0,
        workingMode: 'extended',
      },
    };

    const buffers = new Map([
      ['pad_st.wav', stereoWav],
      ['hit_mono.wav', monoWav],
    ]);

    return exportRawSamplerLibrary(
      session,
      { format: 'sf2', resolution: 'pcm16', sampleRate: 'original', normalization: 'none', layout: 'monolithic' },
      (n) => buffers.get(n),
    ).then((exported) => {
      const sf2Buf = exported.data.buffer.slice(exported.data.byteOffset, exported.data.byteOffset + exported.data.byteLength);
      const imported = importSf2PresetToNative(sf2Buf, 0);
      expect(imported.extendedRegions).toHaveLength(2);

      const stereoReg = imported.extendedRegions.find((r) => r.rootKey === 60);
      expect(stereoReg?.numChannels).toBe(2);
      expect(stereoReg?.loopMode).toBe('loop_sustain');
      expect(stereoReg?.loopStart).toBe(200);
      expect(stereoReg?.loopEnd).toBe(2400);
      expect(stereoReg?.volume).toBe(-6);

      const decodedStereo = decodeWav(imported.audioFiles.find((f) => f.name === stereoReg.sampleName).buffer);
      expect(decodedStereo.numChannels).toBe(2);
      // Left channel ~ 440 Hz, Right channel ~ 880 Hz (distinct stereo signals preserved!)
      const fL = estimateDominantFreqGoertzel(decodedStereo.channels[0], 48000, [440, 880]);
      const fR = estimateDominantFreqGoertzel(decodedStereo.channels[1], 48000, [440, 880]);
      expect(fL).toBe(440);
      expect(fR).toBe(880);

      const noLoopReg = imported.extendedRegions.find((r) => r.rootKey === 36);
      expect(noLoopReg?.loopMode).toBe('no_loop');

      // Test S6.4 malformed sampleRate & out-of-bounds shdr detection directly on valid SF2 clone
      const forged = buildSoundFont2Archive({
        bankName: 'Evil',
        samples: [
          {
            name: 's0',
            sampleRate: 48000,
            rootKey: 60,
            detuneCents: 0,
            loopMode: 'no_loop',
            loopStart: 0,
            loopEnd: 0,
            pcm16: new Int16Array(128),
          },
        ],
        regions: [],
      });
      // Find 'shdr' chunk and corrupt sampleRate to 999999
      const dv = new DataView(forged.buffer, forged.byteOffset, forged.byteLength);
      for (let off = 12; off + 48 < dv.byteLength; off++) {
        if (
          dv.getUint8(off) === 0x73 &&
          dv.getUint8(off + 1) === 0x68 &&
          dv.getUint8(off + 2) === 0x64 &&
          dv.getUint8(off + 3) === 0x72
        ) {
          dv.setUint32(off + 8 + 36, 999999, true);
          break;
        }
      }
      const forgedAb = forged.buffer.slice(forged.byteOffset, forged.byteOffset + forged.byteLength);
      expect(() => listSf2Presets(forgedAb)).toThrow(/out of bounds/);
      expect(() => importSf2PresetToNative(forgedAb, 0)).toThrow(/out of bounds/);
    });
  });

  it('SFZ export: resamples with Blackman windowed-sinc scaling loop frames and writes separate ampeg_delay/attack/hold', async () => {
    const wav48k = makeSineWav(440, 48000, 9600);
    const art = createDefaultArticulation();
    art.ampEnvEnabled = true;
    art.ampEnv = {
      delaySec: 0.05,
      attackSec: 0.2,
      holdSec: 0.1,
      decaySec: 0.3,
      sustainLevel: 0.6,
      releaseSec: 0.25,
    };

    const session = {
      id: 'sfz-export-test',
      name: 'SincPad',
      zones: [],
      extendedRegions: [
        {
          id: 'reg-1',
          sampleName: 'pad.wav',
          lowKey: 48,
          highKey: 72,
          rootKey: 60,
          lowVel: 1,
          highVel: 127,
          detune: 0,
          volume: 0,
          pan: 0,
          pitchKeytrack: 100,
          trigger: 'attack',
          keyFadeIn: 0,
          keyFadeOut: 0,
          velFadeIn: 0,
          velFadeOut: 0,
          fadeCurve: 'equal-power',
          loopMode: 'loop_continuous',
          loopStart: 960,
          loopEnd: 4800,
          loopCrossfadeMs: 0,
        },
      ],
      articulation: art,
      processConfig: {
        modelNumber: 0,
        modelName: 'SincPad',
        expandedName: 'SincPad',
        complexity: 8,
        parameterSet: 0,
        workingMode: 'extended',
      },
    };

    const res = await exportRawSamplerLibrary(
      session,
      { format: 'sfz', resolution: 'pcm24', sampleRate: 44100, normalization: 'none', layout: 'folder_samples' },
      (n) => (n === 'pad.wav' ? wav48k : undefined),
    );

    const zipEntries = parseZipArchive(res.data);
    const sfzEntry = zipEntries.find((e) => e.path.endsWith('.sfz'));
    expect(sfzEntry).toBeDefined();
    const sfzText = new TextDecoder('utf-8').decode(sfzEntry.data);

    // DAHDSR stages are preserved separately rather than summed
    expect(sfzText).toContain('ampeg_delay=0.050');
    expect(sfzText).toContain('ampeg_attack=0.200');
    expect(sfzText).toContain('ampeg_hold=0.100');

    // Loop points scaled by 44100 / 48000 = 0.91875 (960 -> 882, 4800 -> 4410)
    expect(sfzText).toContain('loop_start=882');
    expect(sfzText).toContain('loop_end=4410');

    const wavOut = zipEntries.find((e) => e.path.endsWith('.wav'));
    expect(decodeWav(wavOut.data.buffer.slice(wavOut.data.byteOffset, wavOut.data.byteOffset + wavOut.data.byteLength)).sampleRate).toBe(44100);
  });

  it('Canonical Capsule (.sfz.zip -> .abdsmpl.zip & .neuronikmodel) and Offline Renderer produce accurate deterministic pitch, loops & filter diffs', async () => {
    // 1. Build a .sfz.zip pitched at root A4 (69, 440 Hz) with short sustain loop
    const sr = 48000;
    const loopCycles = 20; // exact integer cycles at 440 Hz -> ~2181.8 frames -> pick 2400 Hz or 480 Hz for zero-seam loop, or 440 Hz continuous phase across whole clip
    const rawTone = makeSineWav(440, sr, 4800);
    const sfzText = [
      '<control>default_path=Samples/',
      '<global>ampeg_attack=0.005 ampeg_decay=0.1 ampeg_sustain=80 ampeg_release=0.15',
      '<region>sample=a4.wav lokey=48 hikey=84 pitch_keycenter=69 loop_mode=loop_sustain loop_start=480 loop_end=2662',
    ].join('\n');

    const sfzZip = createZipArchive([
      { path: 'SynthLead.sfz', data: sfzText },
      { path: 'Samples/a4.wav', data: new Uint8Array(rawTone) },
    ]);

    const importedFromSfzZip = await parseUniversalSamplerInstrument(
      'SynthLead.sfz.zip',
      sfzZip.buffer.slice(sfzZip.byteOffset, sfzZip.byteOffset + sfzZip.byteLength),
    );
    expect(importedFromSfzZip.regions).toHaveLength(1);
    expect(importedFromSfzZip.regions[0].loopMode).toBe('loop_sustain');

    // 2. Save to canonical capsule (.abdsmpl.zip) and re-import
    const capsuleBytes = exportUniversalSamplerCapsule(importedFromSfzZip);
    const reloadedCapsule = await parseUniversalSamplerInstrument(
      'SynthLead.abdsmpl.zip',
      capsuleBytes.buffer.slice(capsuleBytes.byteOffset, capsuleBytes.byteOffset + capsuleBytes.byteLength),
    );
    expect(reloadedCapsule.regions).toHaveLength(1);
    expect(reloadedCapsule.regions[0].rootKey).toBe(69);
    expect(reloadedCapsule.regions[0].loopMode).toBe('loop_sustain');
    expect(reloadedCapsule.audioPool?.size).toBe(1);

    // 3. Also verify .neuronikmodel 01_raw_source/native_map.json import path
    const neuronicZip = createZipArchive([
      {
        path: 'manifest.json',
        data: JSON.stringify({ modelName: 'NeuroTone', expandedName: 'NeuroTone Capsule' }),
      },
      {
        path: '01_raw_source/native_map.json',
        data: JSON.stringify({
          schemaVersion: '1.0',
          layer: '01_raw_source',
          zones: [],
          extendedRegions: importedFromSfzZip.regions,
          sampleNames: ['a4.wav'],
        }),
      },
      { path: '01_raw_source/a4.wav', data: new Uint8Array(rawTone) },
    ]);
    const loadedNeuron = await parseUniversalSamplerInstrument(
      'NeuroTone.neuronikmodel',
      neuronicZip.buffer.slice(neuronicZip.byteOffset, neuronicZip.byteOffset + neuronicZip.byteLength),
    );
    expect(loadedNeuron.expandedName).toBe('NeuroTone Capsule');
    expect(loadedNeuron.regions).toHaveLength(1);

    // 4. Deterministic offline rendering at MIDI 81 (+12 semitones -> 880 Hz), hold 0.4s (> 0.1s sample len -> proves sustain loop active)
    const render1 = renderUniversalSamplerNoteOffline(reloadedCapsule, {
      midiNote: 81,
      velocity: 110,
      noteHoldSec: 0.4,
      releaseTailSec: 0.2,
      sampleRate: 48000,
    });
    const render2 = renderUniversalSamplerNoteOffline(reloadedCapsule, {
      midiNote: 81,
      velocity: 110,
      noteHoldSec: 0.4,
      releaseTailSec: 0.2,
      sampleRate: 48000,
    });

    expect(render1.numFrames).toBe(28800);
    expect(render1.activeRegionIds).toHaveLength(1);
    expect(render1.peakLinear).toBeGreaterThan(0.2);

    // Check dominant pitch shifted cleanly from 440 Hz -> 880 Hz
    const domFreq = estimateDominantFreqGoertzel(render1.left, 48000, [440, 660, 880, 1320]);
    expect(domFreq).toBe(880);

    // Verify 100% deterministic bit-exact repeatability
    let diffSq = 0;
    for (let i = 0; i < render1.left.length; i++) {
      const d = render1.left[i] - render2.left[i];
      diffSq += d * d;
    }
    expect(diffSq).toBe(0);

    // Enable 450 Hz LPF and confirm attenuation at 880 Hz
    const filteredInst = {
      ...reloadedCapsule,
      articulation: {
        ...reloadedCapsule.articulation,
        filter: {
          ...reloadedCapsule.articulation.filter,
          enabled: true,
          type: 'lpf',
          poles: 4,
          cutoffHz: 350,
          resonanceDb: 0,
        },
      },
    };
    const renderFiltered = renderUniversalSamplerNoteOffline(filteredInst, {
      midiNote: 81,
      velocity: 110,
      noteHoldSec: 0.4,
      releaseTailSec: 0.2,
      sampleRate: 48000,
    });
    expect(renderFiltered.rmsLinear).toBeLessThan(render1.rmsLinear * 0.45);
  });
});

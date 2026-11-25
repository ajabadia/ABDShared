/**
 * @abdsynths/contracts — Contracts/memoryEngineBridge.ts
 * Creates an in-memory EnginePanelBridge for Vitest suites, offline previews,
 * and standalone component verification without WASM or native C++ runtime.
 */

import type { EnginePanelBridge, EnginePanelDescriptor, EnginePatchMeta } from './enginePanelBridge';

export function createMemoryEngineBridge(
  descriptor: EnginePanelDescriptor,
  initialState: Record<string, number> = {},
  factoryPresets: readonly string[] = []
): EnginePanelBridge & { setExternalState(patch: Record<string, number>, presetName?: string): void } {
  const state: Record<string, number> = { ...initialState };
  const listeners = new Set<(next: Record<string, number>) => void>();
  let presetName = factoryPresets[0] ?? '';

  const notify = () => {
    const snap = { ...state };
    listeners.forEach((fn) => fn(snap));
  };

  return {
    getDescriptor: () => ({ ...descriptor }),
    setParam(key: string, value: number) { state[key] = value; },
    getParam(key: string): number {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : 0;
    },
    getState: () => ({ ...state }),
    onStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPresetName: () => presetName,
    listFactoryPresets: () => [...factoryPresets],
    loadFactoryPreset(index: number): boolean {
      if (index < 0 || index >= factoryPresets.length) return false;
      presetName = factoryPresets[index];
      state['mode.drum'] = index >= 16 ? 1 : 0;
      notify();
      return true;
    },
    getPatchMeta(): EnginePatchMeta {
      return { presetName, isDrumKit: (state['mode.drum'] ?? 0) >= 0.5, partials: [], populatedDrumNotes: [] };
    },
    auditionNote(note: number, velocity = 0.85, durationMs = 180) {
      state['activeNote'] = note;
      state['gate'] = 1;
      state['sounding'] = 1;
      state['level'] = Math.max(0.4, velocity);
      notify();
      if (durationMs > 0) setTimeout(() => { state['gate'] = 0; notify(); }, durationMs);
    },
    initPatch(mode?: 'chromatic' | 'drum_map') {
      const isDrum = mode === 'drum_map';
      state['mode.drum'] = isDrum ? 1 : 0;
      if (!isDrum) {
        state['structure'] = 0;
        state['p1.enabled'] = 1; state['p1.source'] = 2; state['p1.wave'] = 0; state['p1.level'] = 0.85;
        state['p2.enabled'] = 0; state['p3.enabled'] = 0; state['p4.enabled'] = 0;
      }
      presetName = isDrum ? 'Init Drum Kit' : 'Init Chromatic';
      notify();
    },
    applyPresetSnapshot(params: Record<string, number>, nextPresetName?: string) {
      Object.assign(state, params);
      if (typeof nextPresetName === 'string') presetName = nextPresetName;
      notify();
    },
    setExternalState(patch: Record<string, number>, nextPresetName?: string) {
      Object.assign(state, patch);
      if (typeof nextPresetName === 'string') presetName = nextPresetName;
      notify();
    },
  };
}

/**
 * ABDShared -- tests/fxFaceplates.test.js
 * Unit tests for FxFaceplateBridge, FxFaceplateRegistry, faceplates and FxFaceplateModal.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryFxBridge } from '../Contracts/fxFaceplateBridge.ts';
import {
  FxFaceplateModal,
  getFxDescriptor,
  mountFxFaceplate,
  Re201Faceplate,
  ZitaReverbFaceplate,
  BbdChorusFaceplate,
  StereoDelayFaceplate,
  SaturationFaceplate,
  GenericFxFaceplate,
} from '../Components/FxFaceplates/index.js';

describe('FxFaceplates & FxFaceplateModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('retrieves descriptor and pre-configured metadata for canonical algorithms', () => {
    const re201 = getFxDescriptor('space_echo');
    expect(re201.name).toBe('Space Echo RE-201');
    expect(re201.badge).toBe('RE2');
    expect(re201.canDuck).toBe(true);
    expect(re201.tailSec).toBe(5.0);

    const zita = getFxDescriptor('zita');
    expect(zita.name).toBe('Zita Reverb');
    expect(zita.badge).toBe('REV');
    expect(zita.category).toBe('reverb');

    const bbd = getFxDescriptor('bbd_chorus');
    expect(bbd.name).toBe('Roland BBD Chorus');
    expect(bbd.canDuck).toBe(false);

    const generic = getFxDescriptor('unknown_custom_fx');
    expect(generic.algoId).toBe('unknown_custom_fx');
    expect(generic.badge).toBe('REV'); // fallback category
  });

  it('mounts bespoke faceplates based on bridge descriptor', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const re201Bridge = createMemoryFxBridge(getFxDescriptor('space_echo'), { rate: 0.6, intensity: 0.7 });
    const fp1 = mountFxFaceplate(container, re201Bridge);
    expect(fp1).toBeInstanceOf(Re201Faceplate);
    expect(container.querySelector('.abd-re201-faceplate')).toBeTruthy();
    fp1.destroy();

    const zitaBridge = createMemoryFxBridge(getFxDescriptor('zita'), { decay: 0.5 });
    const fp2 = mountFxFaceplate(container, zitaBridge);
    expect(fp2).toBeInstanceOf(ZitaReverbFaceplate);
    expect(container.querySelector('.abd-zita-faceplate')).toBeTruthy();
    fp2.destroy();

    const bbdBridge = createMemoryFxBridge(getFxDescriptor('bbd_chorus'), { rate: 0.3 });
    const fp3 = mountFxFaceplate(container, bbdBridge);
    expect(fp3).toBeInstanceOf(BbdChorusFaceplate);
    expect(container.querySelector('.abd-bbd-faceplate')).toBeTruthy();
    fp3.destroy();

    const delayBridge = createMemoryFxBridge(getFxDescriptor('stereo_delay'), { time: 0.4 });
    const fp4 = mountFxFaceplate(container, delayBridge);
    expect(fp4).toBeInstanceOf(StereoDelayFaceplate);
    expect(container.querySelector('.abd-delay-faceplate')).toBeTruthy();
    fp4.destroy();

    const satBridge = createMemoryFxBridge(getFxDescriptor('saturation'), { drive: 0.8 });
    const fp5 = mountFxFaceplate(container, satBridge);
    expect(fp5).toBeInstanceOf(SaturationFaceplate);
    expect(container.querySelector('.abd-sat-faceplate')).toBeTruthy();
    fp5.destroy();

    const genericBridge = createMemoryFxBridge({
      algoId: 'weird_ringmod', name: 'Weird RingMod', category: 'pitch', badge: 'RNG',
      baseColor: '#201020', accentColor: '#ff2288', icon: 'zap', tailSec: 0.1, canDuck: false,
      presets: ['Preset A'], params: [{ key: 'carrier', label: 'CARRIER', defaultValue: 0.5 }],
    });
    const fp6 = mountFxFaceplate(container, genericBridge);
    expect(fp6).toBeInstanceOf(GenericFxFaceplate);
    expect(container.querySelector('.abd-generic-fx-faceplate')).toBeTruthy();
    fp6.destroy();
  });

  it('manages modal dialog lifecycle: open, preset change, bypass, ducking and close', () => {
    const modal = new FxFaceplateModal();
    expect(modal.isOpen()).toBe(false);

    const bridge = createMemoryFxBridge(getFxDescriptor('space_echo'), { rate: 0.4 });
    modal.open(0, 'space_echo', 'Echo Solo Lead', bridge);

    expect(modal.isOpen()).toBe(true);
    expect(document.querySelector('.abd-fx-modal-backdrop')).toBeTruthy();
    expect(document.querySelector('.abd-fx-modal-title')?.textContent).toBe('Space Echo RE-201');
    expect(document.querySelector('.abd-fx-modal-custom-name')?.textContent).toContain('Echo Solo Lead');

    // Bypass button
    const bypassBtn = document.querySelector('#fx-modal-bypass');
    expect(bypassBtn?.textContent?.trim()).toBe('POWER ON');
    bypassBtn?.dispatchEvent(new MouseEvent('click'));
    expect(bridge.isBypassed()).toBe(true);
    expect(bypassBtn?.textContent?.trim()).toBe('BYPASS (0% CPU)');

    // Ducking button
    const duckBtn = document.querySelector('#fx-modal-duck');
    expect(duckBtn?.classList.contains('is-active')).toBe(true);
    duckBtn?.dispatchEvent(new MouseEvent('click'));
    expect(bridge.getDucking().enabled).toBe(false);

    // Preset selection
    const presetSelect = document.querySelector('#fx-modal-presets');
    if (presetSelect) {
      presetSelect.value = '1';
      presetSelect.dispatchEvent(new Event('change'));
      expect(bridge.getPresetName()).toBe('Reverb+Delay 4');
    }

    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(document.querySelector('.abd-fx-modal-backdrop')).toBeFalsy();
  });
});

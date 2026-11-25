import { describe, expect, it, vi } from 'vitest';
import { getParameterSpec } from '../Contracts/parameterSpecCatalog.js';
import { buildDefaultPerformanceMap } from '../Components/PerformanceDeck/performanceMapStore.js';
import { PerformanceDeck } from '../Components/PerformanceDeck/performanceDeck.js';

describe('PerformanceDeck UI component (Bloque B)', () => {
  it('preserves classic overlay silhouette, stickToolbarSlot and non-inline Edit callback', () => {
    const host = document.createElement('div');
    const onEdit = vi.fn();
    const onVoice = vi.fn();
    const deck = new PerformanceDeck(host, {
      layout: 'overlay',
      badge: '<NUKE>',
      title: 'REMOTE CONTROL UNIT',
      inlineEdit: false,
      hasStickToolbar: true,
      voiceLimit: 8,
      macros: [
        { id: 1, name: 'KNOB 1', label: 'Cutoff', value: 0.5 },
        { id: 2, name: 'KNOB 2', label: 'Blend', value: 0.4 },
        { id: 3, name: 'KNOB 3', label: 'Attack', value: 0.2 },
        { id: 4, name: 'KNOB 4', label: 'Reso', value: 0.3 },
      ],
      controllers: [
        { id: 0, name: 'AFTERTOUCH', shortName: 'AT', destLabel: 'Cutoff', depth: 0.2 },
        { id: 1, name: 'MOD', shortName: 'MOD', destLabel: 'LFO', depth: 0 },
        { id: 2, name: 'BREATH', shortName: 'BRTH', destLabel: 'Vol', depth: 0 },
        { id: 3, name: 'CC 03', shortName: 'CC03', destLabel: '---', depth: 0 },
        { id: 4, name: 'FOOT', shortName: 'FOOT', destLabel: '---', depth: 0 },
        { id: 5, name: 'EXPRESSION', shortName: 'EXPR', destLabel: 'Vol', depth: -0.25 },
      ],
      onEdit,
      onVoiceLimitChange: onVoice,
    });

    expect(deck.el.tagName).toBe('SECTION');
    expect(deck.macroKnobs.size).toBe(10);
    expect(deck.centralStick).not.toBeNull();

    const customChip = document.createElement('span');
    customChip.id = 'ax-stick-chip';
    customChip.textContent = 'Resys 1';
    deck.getStickToolbarSlot().appendChild(customChip);

    deck.setVoiceLimit(12);
    expect(onVoice).toHaveBeenCalledWith(12);
    expect(deck.el.querySelector('#ax-stick-chip')).toBe(customChip);

    deck.updateMacro(1, 0.8);
    expect(deck.el.querySelector('[data-val-slot="0"]')?.textContent).toBe('80%');
    deck.updateControllerDepth(5, 0.5);
    expect(deck.el.querySelector('[data-val-slot="9"]')?.textContent).toBe('+50%');

    deck.el.querySelector('[data-act="edit"]')?.click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(deck.editMode).toBe(false);

    deck.toggle();
    expect(deck.isOpen).toBe(true);
    deck.close();
    expect(deck.isOpen).toBe(false);
    deck.destroy();
  });

  it('disables excess slots cleanly instead of duplicating slot 0', () => {
    const host = document.createElement('div');
    const deck = new PerformanceDeck(host, {
      layout: 'overlay',
      macros: [
        { id: 1, name: 'M1', label: 'Cut', value: 0.6 },
        { id: 2, name: 'M2', label: 'Res', value: 0.2 },
      ],
      controllers: [],
    });
    expect(deck.macroKnobs.size).toBe(2);
    for (let i = 2; i < 10; i++) {
      expect(deck.el.querySelector(`[data-slot-card="${i}"]`)?.classList.contains('is-disabled')).toBe(true);
    }
    deck.destroy();
  });

  it('supports modeless dialog, live setEngineContext morphing, PIN and RE-ENABLE AUTO', () => {
    const host = document.createElement('div');
    const onPin = vi.fn();
    const onReEnable = vi.fn();
    const tbSpec = getParameterSpec('roland_tb303');
    const mcsSpec = getParameterSpec('abdmcs48');
    const mcxSpec = getParameterSpec('abdmcx0x');

    const deck = new PerformanceDeck(host, {
      layout: 'modeless',
      inlineEdit: true,
      hasPinToggle: true,
      hasFooterSlot: true,
      accentColorVar: 'var(--color-bank-b)',
      badge: 'TB-303',
      title: 'P02 BASS',
      spec: tbSpec,
      map: buildDefaultPerformanceMap(tbSpec),
      onPinChange: onPin,
      onReEnableAuto: onReEnable,
    });

    const footerBtn = document.createElement('button');
    footerBtn.id = 'mcx-track-mute';
    deck.getFooterSlot().appendChild(footerBtn);

    deck.open();
    expect(deck.el.tagName).toBe('DIALOG');
    expect(deck.isOpen).toBe(true);
    expect(deck.el.style.getPropertyValue('--perf-accent')).toBe('var(--color-bank-b)');
    expect(deck.macroKnobs.size).toBe(8);
    expect(deck.centralStick).not.toBeNull();

    deck.setEngineContext({ badge: 'MCS-48', title: 'P04 CHIP', accentColorVar: 'invalid-accent', spec: mcsSpec, map: buildDefaultPerformanceMap(mcsSpec) });
    expect(deck.isOpen).toBe(true);
    expect(deck.el.style.getPropertyValue('--perf-accent')).toBe('');
    expect(deck.macroKnobs.size).toBe(6);
    expect(deck.centralStick).toBeNull();
    expect(deck.el.querySelector('.abd-perf-xy-off')?.textContent).toBe('XY OFF');
    expect(deck.el.querySelector('#mcx-track-mute')).toBe(footerBtn);

    deck.setEngineContext({ badge: 'ROMPLER', title: 'P01 LEAD', spec: mcxSpec, map: buildDefaultPerformanceMap(mcxSpec) });
    expect(deck.macroKnobs.size).toBe(10);
    expect(deck.centralStick).not.toBeNull();

    deck.el.querySelector('[data-act="toggle-pin"]')?.click();
    expect(onPin).toHaveBeenCalledWith(true);

    const dragHandle = deck.el.querySelector('[data-drag-handle]');
    const downEv = Object.assign(new Event('pointerdown', { bubbles: true }), { button: 0, clientX: 100, clientY: 20, pointerId: 1 });
    dragHandle?.dispatchEvent(downEv);
    expect(deck.el.style.transform).toBe('none');
    dragHandle?.dispatchEvent(new Event('pointerup', { bubbles: true }));

    deck.setAutomationOverride(true);
    const autoBtn = deck.el.querySelector('[data-act="re-enable-auto"]');
    expect(autoBtn?.hasAttribute('hidden')).toBe(false);
    autoBtn?.click();
    expect(onReEnable).toHaveBeenCalledTimes(1);
    expect(autoBtn?.hasAttribute('hidden')).toBe(true);
    deck.destroy();
  });

  it('handles clean EDIT pulse mode, grouped searchable picker, LEARN, ON/OFF, range and XY edit', () => {
    const host = document.createElement('div');
    const onMap = vi.fn();
    const onPreset = vi.fn();
    const tbSpec = getParameterSpec('roland_tb303');
    const mcsSpec = getParameterSpec('abdmcs48');

    const mcsDeck = new PerformanceDeck(host, {
      layout: 'modeless',
      inlineEdit: true,
      spec: mcsSpec,
      map: buildDefaultPerformanceMap(mcsSpec),
    });
    mcsDeck.el.querySelector('[data-act="edit"]')?.click();
    mcsDeck.el.querySelector('[data-edit-slot="0"]')?.click();
    const pickerListHtml = mcsDeck.picker.dialog.querySelector('.abd-perf-picker-list')?.innerHTML ?? '';
    expect(pickerListHtml).not.toContain('diagnosticTone');
    mcsDeck.destroy();

    const deck = new PerformanceDeck(host, {
      layout: 'modeless',
      inlineEdit: true,
      spec: tbSpec,
      map: buildDefaultPerformanceMap(tbSpec),
      onMapChange: onMap,
      onPresetAction: onPreset,
    });
    deck.el.querySelector('[data-act="edit"]')?.click();
    expect(deck.editMode).toBe(true);
    expect(deck.el.classList.contains('is-editing')).toBe(true);
    expect(deck.el.querySelectorAll('select')).toHaveLength(0);
    expect(deck.el.querySelector('[data-slot-card="8"]')?.classList.contains('is-edit-target')).toBe(true);

    deck.el.querySelector('[data-edit-slot="8"]')?.click();
    expect(deck.picker.isOpen).toBe(true);
    const searchIn = deck.picker.dialog.querySelector('.abd-perf-picker-search');
    searchIn.value = 'vol';
    searchIn.dispatchEvent(new Event('input', { bubbles: true }));
    deck.picker.dialog.querySelector('.abd-perf-picker-item[data-param-id="volume"]')?.click();
    expect(deck.picker.isOpen).toBe(false);
    expect(onMap).toHaveBeenLastCalledWith(expect.objectContaining({
      macros: expect.arrayContaining([expect.objectContaining({ index: 8, enabled: true })]),
    }), 'assign-macro');

    deck.el.querySelector('[data-edit-slot="8"]')?.click();
    const minIn = deck.picker.dialog.querySelector('[data-picker-min]');
    minIn.value = '15';
    minIn.dispatchEvent(new Event('change', { bubbles: true }));
    expect(deck.map.macros[8].targets[0].min).toBeCloseTo(0.15, 2);

    deck.picker.dialog.querySelector('[data-picker-act="toggle-enabled"]')?.click();
    expect(onMap.mock.calls.at(-1)?.[1]).toBe('toggle-slot');

    deck.el.querySelector('[data-edit-slot="9"]')?.click();
    deck.picker.dialog.querySelector('[data-picker-act="learn"]')?.click();
    expect(deck.picker.isOpen).toBe(false);
    expect(deck.el.querySelector('[data-slot-card="9"]')?.classList.contains('is-learning')).toBe(true);
    expect(deck.completeLearn('drive')).toBe(true);
    expect(deck.map.macros[9].targets[0].paramId).toBe('drive');
    expect(onMap.mock.calls.at(-1)?.[1]).toBe('learn');

    deck.el.querySelector('[data-edit-xy-hub]')?.click();
    deck.picker.dialog.querySelector('[data-picker-axis="y"]')?.click();
    deck.picker.dialog.querySelector('.abd-perf-picker-item[data-param-id="cutoff"]')?.click();
    expect(onMap.mock.calls.at(-1)?.[1]).toBe('assign-xy');
    deck.picker.dialog.querySelector('[data-picker-act="toggle-enabled"]')?.click();
    expect(onMap.mock.calls.at(-1)?.[1]).toBe('toggle-xy');

    deck.el.querySelector('[data-preset-act="save-preset"]')?.click();
    expect(onPreset).toHaveBeenCalledWith('save-preset', deck.map);
    deck.destroy();
  });
});

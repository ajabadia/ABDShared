/**
 * ABDShared — tests/coverPopup.test.js
 * Unit tests for canonical CoverPopup hover preview, enlarged lightbox modal,
 * FX rack artwork popups, and EngineHeaderBar cover triggers. Strictly < 200 lines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  attachCoverPopup,
  buildFxCoverPopupData,
  closeAllCoverPopups,
  closeCoverModal,
  hideCoverHoverPopover,
  openCoverModal,
  renderCoverArtHtml,
  showCoverHoverPopover,
} from '../Components/CoverPopup/coverPopup.js';
import { buildFxCoverPopupData as buildFxDataFromIndex, EngineHeaderBar } from '../Components/index.js';
import { MultiBusFxRackModal } from '../Components/multiBusFxRackModal.js';
import { openRackPickerPopover, closeRackPickerPopover } from '../Components/MultiBusFxRack/FxPickerModal.js';
import { createMemoryEngineBridge } from '../Contracts/enginePanelBridge.ts';

describe('Canonical CoverPopup component & consumers', () => {
  beforeEach(() => {
    closeAllCoverPopups();
    document.body.innerHTML = '';
  });

  it('renders cover/contain art HTML and image fallback SVG', () => {
    const sq = renderCoverArtHtml({ coverUrl: '/assets/d50.webp', title: 'Roland D-50', size: 120 });
    expect(sq).toContain('width:120px;height:120px');
    expect(sq).toContain('<img src="/assets/d50.webp"');
    const wide = renderCoverArtHtml({ coverUrl: 'assets/fx/models/re201.webp', width: 240, height: 96, fit: 'contain' });
    expect(wide).toContain('data-fit="contain"');
    expect(wide).toContain('width:240px;height:96px');
    const fb = renderCoverArtHtml({ title: 'No Art', fallbackSvg: '<svg id="fb"></svg>' });
    expect(fb).toContain('<svg id="fb"></svg>');
  });

  it('renders hover popover and enlarged modal with secondary card, meta grid, action button, and Escape close', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onPrimary = vi.fn();

    showCoverHoverPopover(anchor, {
      title: 'Fantasia',
      subtitle: 'Roland D-50 · Structured Rompler',
      badge: 'ROMP · CROMÁTICO',
      category: 'Synth Pad · Roland',
      description: 'LA Synthesis bank',
      filename: 'Roland_D50.abdbank',
      pills: ['A1 · P01', '64 patches'],
      coverUrl: '/assets/d50.webp',
    });
    const pop = document.querySelector('.abd-cover-popover');
    expect(pop?.getAttribute('role')).toBe('tooltip');
    expect(pop?.textContent).toContain('Fantasia');
    expect(pop?.textContent).toContain('Roland_D50.abdbank');

    hideCoverHoverPopover();
    expect(document.querySelector('.abd-cover-popover')).toBeNull();

    openCoverModal({
      title: 'Fantasia',
      modalTitle: 'A1 · Fantasia',
      coverUrl: '/assets/d50.webp',
      secondaryCard: { title: 'Structured Rompler', subtitle: 'Hybrid Engine', coverUrl: '/assets/engines/rompler_faceplate.webp' },
      metaRows: [['Motor', 'Structured Rompler'], { k: 'Archivo', v: 'Roland_D50.abdbank' }],
      primaryAction: { label: 'Abrir Motor', onClick: onPrimary },
    });
    const modal = document.querySelector('.abd-cover-modal');
    expect(modal?.textContent).toContain('A1 · Fantasia');
    expect(modal?.textContent).toContain('Structured Rompler');
    expect(modal?.textContent).toContain('Roland_D50.abdbank');

    document.querySelector('[data-act="cover-primary-act"]').click();
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.abd-cover-modal')).toBeNull();

    openCoverModal({ title: 'Reopen Test', coverUrl: '/assets/d50.webp' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.abd-cover-modal')).toBeNull();
    closeCoverModal();
  });

  it('deduplicates repeated attachCoverPopup bindings and stops propagation when requested', () => {
    const outer = document.createElement('div');
    const outerClick = vi.fn();
    outer.addEventListener('click', outerClick);
    const btn = document.createElement('button');
    outer.appendChild(btn);
    document.body.appendChild(outer);

    const getData = () => ({ title: 'Unit Cover', coverUrl: '/assets/unit.webp', metaRows: [['Band', '2']] });
    attachCoverPopup(btn, getData, { stopPropagation: true });
    attachCoverPopup(btn, getData, { stopPropagation: true });

    btn.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelectorAll('.abd-cover-popover')).toHaveLength(1);
    btn.click();
    expect(outerClick).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.abd-cover-modal')).toHaveLength(1);
    closeAllCoverPopups();
  });

  it('wires EngineHeaderBar cover, MultiBusFxRackModal bays, and FxPickerModal items to CoverPopup', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const bridge = createMemoryEngineBridge({ typeId: 'structured_rompler', displayName: 'ABD Structured Rompler', supportsDrumMode: true }, {}, ['SuperLead']);
    const hb = new EngineHeaderBar(mount, bridge, { locale: 'es' });
    hb.sync({ presetName: 'SuperLead', sourceLabel: 'Roland D-50', categoryId: 0, coverUrl: '/assets/d50.webp' });

    const coverBtn = mount.querySelector('[data-el="cover"]');
    expect(coverBtn?.tagName).toBe('BUTTON');
    coverBtn.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.abd-cover-popover')?.textContent).toContain('SuperLead');
    coverBtn.click();
    expect(document.querySelector('.abd-cover-modal')?.textContent).toContain('Roland D-50');
    closeAllCoverPopups();
    hb.destroy();

    expect(buildFxDataFromIndex('space_echo')?.fit).toBe('contain');
    const onOpenFaceplate = vi.fn();
    const rack = new MultiBusFxRackModal({
      locale: 'es',
      getRackSlots: () => [{ slot: 0, engine: 2, algoId: 'space_echo', name: 'RE-201 Tape', bypass: false }],
      getSendTargets: () => [0, -1, -1, -1],
      onOpenFaceplate,
    });
    const bayThumb = rack.el.querySelector('.fx-bay-thumb-wrap[data-algo-id="space_echo"]');
    expect(bayThumb).toBeTruthy();
    bayThumb.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.abd-cover-popover')?.textContent).toContain('RE-201 Tape');
    bayThumb.click();
    expect(document.querySelector('.abd-cover-modal')?.textContent).toContain('Space Echo RE-201');
    document.querySelector('[data-act="cover-primary-act"]')?.click();
    expect(onOpenFaceplate).toHaveBeenCalledWith(0);
    rack.destroy();

    const pickerPop = openRackPickerPopover({ slotIdx: 0 });
    pickerPop.querySelector('.mcx-rack-picker-item[data-id="zita"]')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.abd-cover-popover')?.textContent).toContain('Zita Reverb');
    closeRackPickerPopover();
    expect(document.querySelector('.abd-cover-popover')).toBeNull();
  });
});

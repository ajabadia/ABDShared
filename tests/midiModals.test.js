import { describe, it, expect, vi, afterEach } from 'vitest';
import { MpcPadModal } from '../Components/Pads/MpcPadModal.js';
import { GrooveArpeggiatorModal } from '../Components/Arpeggiator/GrooveArpeggiatorModal.js';
import { ARP_MOTIFS, DEFAULT_ARP_STATE } from '../Components/Arpeggiator/grooveArpeggiatorContract.js';

describe('MpcPadModal & GrooveArpeggiatorModal (ABDShared)', () => {
  let padModal;
  let arpModal;

  afterEach(() => {
    padModal?.destroy();
    arpModal?.destroy();
    document.querySelectorAll('.abd-pad-dialog, .abd-arp-dialog').forEach((el) => el.remove());
  });

  describe('MpcPadModal', () => {
    it('initializes and renders correctly', () => {
      padModal = new MpcPadModal({ partIndex: 0, locale: 'es' });
      expect(padModal.el).not.toBeNull();
      expect(padModal.el.querySelector('#abd-pad-part-badge').textContent).toBe('P01');
      expect(padModal.matrix).not.toBeNull();
    });

    it('opens, closes and toggles open state', () => {
      padModal = new MpcPadModal({ partIndex: 1 });
      padModal.open();
      expect(padModal.isOpen()).toBe(true);
      padModal.close();
      expect(padModal.isOpen()).toBe(false);
      padModal.toggle();
      expect(padModal.isOpen()).toBe(true);
    });

    it('syncs part state and switches matrix mode', () => {
      padModal = new MpcPadModal({ partIndex: 0 });
      padModal.syncPart(2, { kind: 'chromatic', name: 'Lead 03' });
      expect(padModal.getPart()).toBe(2);
      expect(padModal.matrix.mode).toBe('chromatic');

      padModal.syncPart(3, { kind: 'drum_map', name: 'Kit 909' });
      expect(padModal.matrix.mode).toBe('drum');
    });
  });

  describe('GrooveArpeggiatorModal', () => {
    it('initializes with default state', () => {
      arpModal = new GrooveArpeggiatorModal({ partIndex: 0, locale: 'es' });
      expect(arpModal.el).not.toBeNull();
      expect(arpModal.el.querySelector('#abd-arp-part-badge').textContent).toBe('P01');
      expect(arpModal.state.enabled).toBe(false);
    });

    it('toggles power on/off and triggers onParamChange', () => {
      const onParamChange = vi.fn();
      arpModal = new GrooveArpeggiatorModal({ partIndex: 0, onParamChange });
      const powerBtn = arpModal.el.querySelector('[data-act="toggle-power"]');
      powerBtn.click();

      expect(arpModal.state.enabled).toBe(true);
      expect(onParamChange).toHaveBeenCalledWith(0, 'enabled', true);
    });

    it('selects motif and updates LCD', () => {
      const onParamChange = vi.fn();
      arpModal = new GrooveArpeggiatorModal({ partIndex: 1, onParamChange });
      const randomBtn = arpModal.el.querySelector('[data-act="motif"][data-motif-id="4"]');
      randomBtn.click();

      expect(arpModal.state.motif).toBe(4);
      expect(onParamChange).toHaveBeenCalledWith(1, 'motif', 4);
      expect(arpModal.el.querySelector('#abd-arp-lcd-motif').textContent).toContain('RANDOM');
    });
  });
});

/**
 * ABD Segmented — reusable inline option switcher for the ABDSynths suite.
 */

import { IndexControl } from './indexControl.js';
import { transitioned, announceTransition } from './TransitionNotices.js';
import { arrowStepFor, nextEnabledIndex } from './optionIndex.js';
import {
  buildSegmentedDom,
  clampSegmentedIndex,
  normalizeSegmentedEntry,
  paintSegmented,
} from './segmentedView.js';

export class Segmented extends IndexControl {
  constructor(container, options = {}) {
    super(container, {
      name: 'Segmented',
      kind: 'segmented',
      entries: (options.options ?? []).map(normalizeSegmentedEntry),
      disabledSpec: options.disabled ?? [],
      value: clampSegmentedIndex(options.value, options.options),
      skin: options.skin,
      options,
    });
  }

  prepareEntries() {
    this.variant = this.options.variant === 'led' ? 'led' : 'strip';
    if (Array.isArray(this.options.glyphs)) {
      this.options.glyphs.forEach((glyph, index) => {
        if (this.entries[index] && this.entries[index].glyph === '') {
          this.entries[index].glyph = String(glyph ?? '');
        }
      });
    }
  }

  buildDom() {
    buildSegmentedDom(this);
  }

  attachInteraction() {
    const onActivate = (event) => {
      const index = Number(event.currentTarget.dataset.index);
      if (this.isIndexDisabled(index)) return;
      this.commit(index);
    };

    const onKey = (event) => {
      const step = arrowStepFor(event.key);
      if (step === 0) return;
      event.preventDefault();

      const previous = this.value;
      const next = nextEnabledIndex(
        (at) => this.isIndexDisabled(at),
        this.entries.length,
        previous,
        step
      );
      if (!transitioned(previous, next) || this.isIndexDisabled(next)) return;

      this.commit(next);
      this.buttons[this.value]?.focus();
    };

    for (const button of this.buttons) this.listen(button, 'click', onActivate);
    this.listen(this.group, 'keydown', onKey);
  }

  commit(index) {
    const previous = this.value;
    this.value = index;
    this.render();
    announceTransition(this.options.onChange, previous, index);
  }

  render() {
    paintSegmented(this);
  }
}

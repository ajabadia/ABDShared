/**
 * ABD Select — reusable option list for the ABDSynths suite.
 */

import { IndexControl } from './indexControl.js';
import { clampIndex } from './optionIndex.js';
import { applyFieldNote, buildSelectDom, normalizeSelectEntry } from './selectView.js';

export class Select extends IndexControl {
  constructor(container, options = {}) {
    super(container, {
      name: 'Select',
      kind: 'select',
      entries: (options.options ?? []).map(normalizeSelectEntry),
      disabledSpec: options.disabled ?? [],
      value: clampIndex((options.options ?? []).length, options.value),
      skin: options.skin,
      options,
    });
  }

  buildDom() {
    buildSelectDom(this);
  }

  attachInteraction() {
    const onChange = () => {
      const index = Number(this.field.value);
      if (this.isIndexDisabled(index)) {
        this.render();
        return;
      }
      this.value = index;
      this.render();
      this.options.onChange?.(this.value);
    };
    this.listen(this.field, 'change', onChange);
  }

  setNote(index, text) {
    super.setNote(index, text);
    this.render();
  }

  render() {
    const hasOptions = this.entries.length > 0;
    if (hasOptions) this.field.value = `${this.clampIndex(this.value)}`;

    [...this.field.options].forEach((option, index) => {
      option.disabled = this.isIndexDisabled(index);
    });

    this.field.disabled = !hasOptions;
    this.wrapper.dataset.divergent = this.isDivergent() && hasOptions ? 'true' : 'false';
    this.setFieldNote(this.field.options[this.value]?.getAttribute('aria-describedby') ?? null);
  }

  setFieldNote(noteId) {
    this.fieldNoteId = applyFieldNote(this.field, this.fieldNoteId, noteId);
  }
}

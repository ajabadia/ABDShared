import { clampIndex } from './optionIndex.js';

export function normalizeSegmentedEntry(entry) {
  if (typeof entry === 'string') {
    return { label: entry, glyph: '', disabled: false, note: '' };
  }
  return {
    label: `${entry?.label ?? ''}`,
    glyph: entry?.glyph != null ? String(entry.glyph) : '',
    disabled: Boolean(entry?.disabled),
    note: entry?.note ?? '',
  };
}

export const clampSegmentedIndex = (value, list) => clampIndex((list ?? []).length, value);

export function buildSegmentedDom(ctrl) {
  ctrl.wrapper = document.createElement('div');
  ctrl.wrapper.className = 'abd-segmented';
  if (ctrl.variant !== 'strip') ctrl.wrapper.classList.add(`abd-segmented--${ctrl.variant}`);

  ctrl.createLabel('abd-segmented', ctrl.options.label, ctrl.options.id);

  ctrl.group = document.createElement('div');
  ctrl.group.className = 'abd-segmented__group';
  ctrl.group.setAttribute('role', 'radiogroup');

  if (ctrl.options.id) {
    ctrl.group.id = ctrl.options.id;
    if (ctrl.labelEl != null) {
      ctrl.group.setAttribute('aria-labelledby', `${ctrl.options.id}-label`);
      ctrl.labelEl.id = `${ctrl.options.id}-label`;
    }
  } else if (ctrl.options.label) {
    ctrl.group.setAttribute('aria-label', ctrl.options.label);
  }

  ctrl.wrapper.appendChild(ctrl.group);
  ctrl.notes = ctrl.createNotes('abd-segmented', (index) => ctrl.buttons[index]);
  ctrl.buttons = [];

  ctrl.entries.forEach((entry, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'abd-segmented__segment';
    button.setAttribute('role', 'radio');
    button.dataset.index = `${index}`;

    if (entry.glyph !== '') {
      button.classList.add('abd-segmented__segment--glyphed');
      const glyphSpan = document.createElement('span');
      glyphSpan.className = 'abd-segmented__glyph';
      glyphSpan.innerHTML = entry.glyph; // trusted inline SVGs
      button.appendChild(glyphSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'abd-segmented__text';
    textSpan.textContent = entry.label;
    button.appendChild(textSpan);

    ctrl.group.appendChild(button);
    ctrl.buttons[index] = button;
    ctrl.notes.wire(index, entry.note);
  });

  ctrl.container.appendChild(ctrl.wrapper);
}

export function paintSegmented(ctrl) {
  ctrl.buttons.forEach((button, index) => {
    const active = index === ctrl.value;
    const disabled = ctrl.isIndexDisabled(index);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
    if (disabled) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
    button.tabIndex = active ? 0 : -1;
  });
  ctrl.wrapper.dataset.divergent = ctrl.isDivergent() ? 'true' : 'false';
}

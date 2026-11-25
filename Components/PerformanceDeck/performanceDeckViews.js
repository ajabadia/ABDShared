/**
 * ABDShared — PerformanceDeck/performanceDeckViews.js
 * Pure HTML builders for PerformanceDeck (10 aseptic knobs, XY stick, clean EDIT targets).
 * Strict line limit: < 145 lines. 0 #hex colors.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSlotCardHtml(slot, variant, state) {
  const learning = state.learnTarget?.kind === 'macro' && state.learnTarget.slotIdx === slot.index;
  const editCls = state.editMode ? `is-edit-target${slot.enabled ? '' : ' is-slot-off'}` : (!slot.enabled ? 'is-disabled' : '');
  const cls = ['abd-perf-card', `abd-perf-card--${variant}`, editCls, learning ? 'is-learning' : ''].filter(Boolean).join(' ');
  const headerTxt = escapeHtml(slot.title || slot.label || `SLOT ${slot.index + 1}`);
  const valTxt = slot.enabled ? escapeHtml(slot.formatted) : 'OFF';
  const rawSub = learning ? 'LISTENING…' : (!slot.enabled && state.editMode ? 'CLICK TO ASSIGN' : (slot.subtitle || (slot.enabled ? slot.label : 'UNASSIGNED')));
  const subTxt = escapeHtml(rawSub);
  const pfx = state.domPrefix ? `${escapeHtml(state.domPrefix)}-` : '';
  const idAttr = (slot.index < 4 && pfx) ? ` id="${pfx}macro-knob-mount-${slot.index + 1}"` : '';
  const editAttrs = state.editMode ? ` data-edit-slot="${slot.index}" role="button" tabindex="0"` : '';
  const mountHtml = slot.enabled
    ? `<div class="abd-perf-knob-mount"${idAttr} data-knob-slot="${slot.index}" data-midi-learn-key="perf.macro.${slot.index + 1}"></div>`
    : `<div class="abd-perf-knob-empty"${idAttr} data-knob-slot="${slot.index}">—</div>`;

  return `
    <div class="${cls}" data-slot-card="${slot.index}"${editAttrs}>
      <span class="abd-perf-macro-title">${headerTxt}</span>
      ${mountHtml}
      <span class="stat-num abd-perf-macro-value" data-val-slot="${slot.index}">${valTxt}</span>
      <span class="abd-perf-target-pill" data-sub-slot="${slot.index}" title="${subTxt}">${subTxt}</span>
    </div>`;
}

function buildCenterHubHtml(xyState, state) {
  const xLearn = state.learnTarget?.kind === 'xy' && state.learnTarget.axis === 'x';
  const yLearn = state.learnTarget?.kind === 'xy' && state.learnTarget.axis === 'y';
  const disabledCls = (!xyState.enabled && !state.editMode) ? 'is-disabled' : '';
  const editAttrs = state.editMode ? ' data-edit-xy-hub="1" role="button" tabindex="0"' : '';
  const hubCls = ['abd-perf-center-hub', state.editMode ? 'is-edit-target' : '', (xLearn || yLearn) ? 'is-learning' : ''].filter(Boolean).join(' ');
  const chipTxt = xLearn ? 'LISTENING X…' : (yLearn ? 'LISTENING Y…' : (!xyState.enabled ? 'XY OFF · CLICK TO EDIT' : `XY: ${xyState.xName || '—'} / ${xyState.yName || '—'} · EDIT`));
  const xyEditChip = state.editMode ? `<span class="abd-perf-xy-edit-chip" data-el="xy-edit-chip">${escapeHtml(chipTxt)}</span>` : '';

  const stickIdAttr = state.domPrefix ? ` id="${escapeHtml(state.domPrefix)}-central-stick-mount"` : '';
  return `
    <div class="${hubCls}"${editAttrs}>
      <div class="abd-perf-stick-toolbar" data-slot="stick-toolbar" hidden></div>
      <div class="abd-perf-stick-mount ${disabledCls}"${stickIdAttr} data-slot="stick-mount" data-midi-learn-x="perf.xy.x" data-midi-learn-y="perf.xy.y">
        ${xyState.enabled ? '' : '<div class="abd-perf-xy-off">XY OFF</div>'}
      </div>
      ${xyEditChip}
    </div>`;
}

export function buildDeckShellHtml(opts, state, slots, xyState) {
  const badge = escapeHtml(opts.badge || 'PERF');
  const title = escapeHtml(opts.title || 'PERFORMANCE DECK');
  const caption = escapeHtml(opts.caption || '');
  const curVoices = opts.voiceLimit ?? 16;
  const dragAttr = opts.layout === 'modeless' ? ' data-drag-handle' : '';
  const pinHtml = opts.hasPinToggle ? `<button type="button" class="btn btn-xs btn-outline abd-perf-pin-btn${state.pinned ? ' is-active' : ''}" data-act="toggle-pin">${escapeHtml(state.pinLabel || (state.pinned ? 'PIN' : 'FOLLOW'))}</button>` : '';
  const autoHtml = `<button type="button" class="btn btn-xs btn-outline abd-perf-auto-btn" data-act="re-enable-auto"${state.hasAutomationOverride ? '' : ' hidden'}>↺ RE-ENABLE AUTO</button>`;
  const voicesHtml = opts.hasVoiceLimit !== false ? `
    <div class="abd-perf-deck-pill">
      <span>VOICES:</span>
      <button type="button" class="btn btn-xs btn-outline" data-act="v-dec">−</button>
      <span class="stat-num" data-el="v-val">${String(curVoices).padStart(2, '0')}</span>
      <button type="button" class="btn btn-xs btn-outline" data-act="v-inc">+</button>
    </div>` : '';
  const canEdit = Boolean(opts.inlineEdit || opts.onEdit);
  const editBtn = canEdit ? `<button type="button" class="btn btn-xs btn-outline${state.editMode ? ' is-active' : ''}" data-act="edit">Edit</button>` : '';
  const editBar = opts.inlineEdit && state.editMode ? `
    <div class="abd-perf-edit-bar">
      <button type="button" class="btn btn-xs btn-outline" data-preset-act="reset">Reset Default</button>
      <button type="button" class="btn btn-xs btn-outline" data-preset-act="save-default">Save Default</button>
      <button type="button" class="btn btn-xs btn-outline" data-preset-act="save-preset">Save Preset</button>
      <button type="button" class="btn btn-xs btn-outline" data-preset-act="load-preset">Load Preset</button>
      <button type="button" class="btn btn-xs btn-outline" data-preset-act="import-project">Import .mcxprj</button>
      <span class="abd-perf-edit-hint">Click any control to assign</span>
    </div>` : '';
  const secHead = (opts.secondaryBadge || opts.secondaryCaption || opts.showSecondaryEdit) ? `
    <div class="abd-perf-sec-head">
      <div class="abd-perf-sec-title-group">
        ${opts.secondaryBadge ? `<span class="abd-perf-deck-badge">${escapeHtml(opts.secondaryBadge)}</span>` : ''}
        ${opts.secondaryCaption ? `<span class="abd-perf-deck-caption">${escapeHtml(opts.secondaryCaption)}</span>` : ''}
      </div>
      ${opts.showSecondaryEdit ? `<button type="button" class="btn btn-xs btn-outline" data-act="edit">Edit</button>` : ''}
    </div>` : '';

  return `
    <div class="abd-perf-deck-header"${dragAttr}>
      <div class="abd-perf-deck-title-group">
        <span class="abd-perf-deck-badge">${badge}</span>
        <span class="abd-perf-deck-title">${title}</span>
        ${caption ? `<span class="abd-perf-deck-caption">${caption}</span>` : ''}
      </div>
      <div class="abd-perf-deck-actions">
        ${pinHtml}${autoHtml}${voicesHtml}${editBtn}
        <button type="button" class="btn btn-xs btn-outline" data-act="close">✕ Close</button>
      </div>
    </div>
    ${editBar}
    <div class="abd-perf-deck-body">
      <div class="abd-perf-main-grid">
        <div class="abd-perf-wing-col">
          ${buildSlotCardHtml(slots[1], 'primary', state)}
          ${buildSlotCardHtml(slots[0], 'primary', state)}
        </div>
        ${buildCenterHubHtml(xyState, state)}
        <div class="abd-perf-wing-col">
          ${buildSlotCardHtml(slots[2], 'primary', state)}
          ${buildSlotCardHtml(slots[3], 'primary', state)}
        </div>
      </div>
      <div class="abd-perf-sec-section">
        ${secHead}
        <div class="abd-perf-sec-grid">
          ${slots.slice(4, 10).map((s) => buildSlotCardHtml(s, 'secondary', state)).join('')}
        </div>
      </div>
      <div class="abd-perf-footer-slot" data-slot="footer"${opts.hasFooterSlot ? '' : ' hidden'}></div>
    </div>`;
}
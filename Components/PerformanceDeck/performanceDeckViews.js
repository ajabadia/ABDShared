/**
 * ABDShared — PerformanceDeck/performanceDeckViews.js
 * Pure HTML builders for PerformanceDeck (10 aseptic knobs, XY stick, inline EDIT).
 * Strict line limit: < 185 lines. 0 #hex colors.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildParamOptionsHtml(groupedParams, selectedId, includeDisabled = true) {
  const head = includeDisabled ? `<option value=""${!selectedId ? ' selected' : ''}>— Disabled —</option>` : '';
  const groups = (groupedParams || []).map((b) => {
    const opts = (b.params || []).map((p) => {
      const sel = p.id === selectedId ? ' selected' : '';
      return `<option value="${escapeHtml(p.id)}"${sel}>${escapeHtml(p.name)}</option>`;
    }).join('');
    return `<optgroup label="${escapeHtml(b.group)}">${opts}</optgroup>`;
  }).join('');
  return head + groups;
}

function buildEditRowHtml(slot, state, groupedParams) {
  const tgt = slot.target || { paramId: '', min: 0, max: 1, invert: false };
  const learning = state.learnTarget?.kind === 'macro' && state.learnTarget.slotIdx === slot.index;
  return `
    <div class="abd-perf-edit-row">
      <select class="abd-perf-edit-select" data-edit-param="${slot.index}" aria-label="Slot ${slot.index + 1} parameter">
        ${buildParamOptionsHtml(groupedParams, tgt.paramId)}
      </select>
      <div class="abd-perf-edit-actions">
        <button type="button" class="btn btn-xs btn-outline${learning ? ' is-active' : ''}" data-act="learn-slot" data-slot="${slot.index}">LEARN</button>
        <button type="button" class="btn btn-xs btn-outline${slot.enabled ? ' is-active' : ''}" data-act="toggle-slot" data-slot="${slot.index}">${slot.enabled ? 'ON' : 'OFF'}</button>
      </div>
      <div class="abd-perf-edit-range">
        <input type="number" class="abd-perf-range-in" data-edit-min="${slot.index}" min="0" max="100" value="${Math.round((tgt.min ?? 0) * 100)}" title="Min %" />
        <input type="number" class="abd-perf-range-in" data-edit-max="${slot.index}" min="0" max="100" value="${Math.round((tgt.max ?? 1) * 100)}" title="Max %" />
        <label class="abd-perf-inv-lbl"><input type="checkbox" data-edit-inv="${slot.index}"${tgt.invert ? ' checked' : ''} />INV</label>
      </div>
    </div>`;
}

export function buildSlotCardHtml(slot, variant, state, groupedParams) {
  const learning = state.learnTarget?.kind === 'macro' && state.learnTarget.slotIdx === slot.index;
  const cls = ['abd-perf-card', `abd-perf-card--${variant}`,
    (!slot.enabled && !state.editMode) ? 'is-disabled' : '', learning ? 'is-learning' : ''].filter(Boolean).join(' ');
  const headerTxt = escapeHtml(slot.title || slot.label || `SLOT ${slot.index + 1}`);
  const valTxt = slot.enabled ? escapeHtml(slot.formatted) : 'OFF';
  const subTxt = escapeHtml(slot.subtitle || (slot.enabled ? slot.label : 'UNASSIGNED'));
  const pfx = state.domPrefix ? `${escapeHtml(state.domPrefix)}-` : '';
  const idAttr = (slot.index < 4 && pfx) ? ` id="${pfx}macro-knob-mount-${slot.index + 1}"` : '';
  const mountHtml = slot.enabled
    ? `<div class="abd-perf-knob-mount"${idAttr} data-knob-slot="${slot.index}" data-midi-learn-key="perf.macro.${slot.index + 1}"></div>`
    : `<div class="abd-perf-knob-empty"${idAttr} data-knob-slot="${slot.index}">—</div>`;

  return `
    <div class="${cls}" data-slot-card="${slot.index}">
      <span class="abd-perf-macro-title">${headerTxt}</span>
      ${mountHtml}
      <span class="stat-num abd-perf-macro-value" data-val-slot="${slot.index}">${valTxt}</span>
      <span class="abd-perf-target-pill" data-sub-slot="${slot.index}" title="${subTxt}">${subTxt}</span>
      ${state.editMode ? buildEditRowHtml(slot, state, groupedParams) : ''}
    </div>`;
}

function buildCenterHubHtml(xyState, state, groupedParams) {
  const xLearn = state.learnTarget?.kind === 'xy' && state.learnTarget.axis === 'x';
  const yLearn = state.learnTarget?.kind === 'xy' && state.learnTarget.axis === 'y';
  const disabledCls = (!xyState.enabled && !state.editMode) ? 'is-disabled' : '';
  const xyEdit = state.editMode ? `
    <div class="abd-perf-xy-edit">
      <div class="abd-perf-xy-axis">
        <span>X:</span>
        <select class="abd-perf-edit-select" data-edit-xy="x" aria-label="XY Pad X parameter">${buildParamOptionsHtml(groupedParams, xyState.x?.paramId || '')}</select>
        <button type="button" class="btn btn-xs btn-outline${xLearn ? ' is-active' : ''}" data-act="learn-xy" data-axis="x">LEARN</button>
      </div>
      <div class="abd-perf-xy-axis">
        <span>Y:</span>
        <select class="abd-perf-edit-select" data-edit-xy="y" aria-label="XY Pad Y parameter">${buildParamOptionsHtml(groupedParams, xyState.y?.paramId || '')}</select>
        <button type="button" class="btn btn-xs btn-outline${yLearn ? ' is-active' : ''}" data-act="learn-xy" data-axis="y">LEARN</button>
      </div>
      <button type="button" class="btn btn-xs btn-outline${xyState.enabled ? ' is-active' : ''}" data-act="toggle-xy">XY ${xyState.enabled ? 'ON' : 'OFF'}</button>
    </div>` : '';

  const stickIdAttr = state.domPrefix ? ` id="${escapeHtml(state.domPrefix)}-central-stick-mount"` : '';
  return `
    <div class="abd-perf-center-hub">
      <div class="abd-perf-stick-toolbar" data-slot="stick-toolbar" hidden></div>
      <div class="abd-perf-stick-mount ${disabledCls}"${stickIdAttr} data-slot="stick-mount" data-midi-learn-x="perf.xy.x" data-midi-learn-y="perf.xy.y">
        ${xyState.enabled ? '' : '<div class="abd-perf-xy-off">XY OFF</div>'}
      </div>
      ${xyEdit}
    </div>`;
}

export function buildDeckShellHtml(opts, state, slots, xyState, groupedParams) {
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
          ${buildSlotCardHtml(slots[1], 'primary', state, groupedParams)}
          ${buildSlotCardHtml(slots[0], 'primary', state, groupedParams)}
        </div>
        ${buildCenterHubHtml(xyState, state, groupedParams)}
        <div class="abd-perf-wing-col">
          ${buildSlotCardHtml(slots[2], 'primary', state, groupedParams)}
          ${buildSlotCardHtml(slots[3], 'primary', state, groupedParams)}
        </div>
      </div>
      <div class="abd-perf-sec-section">
        ${secHead}
        <div class="abd-perf-sec-grid">
          ${slots.slice(4, 10).map((s) => buildSlotCardHtml(s, 'secondary', state, groupedParams)).join('')}
        </div>
      </div>
      <div class="abd-perf-footer-slot" data-slot="footer"${opts.hasFooterSlot ? '' : ' hidden'}></div>
    </div>`;
}

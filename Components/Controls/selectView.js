export function normalizeSelectEntry(entry) {
  if (typeof entry === 'string') {
    return { label: entry, disabled: false, note: '' };
  }
  return {
    label: `${entry?.label ?? ''}`,
    disabled: Boolean(entry?.disabled),
    note: entry?.note ?? '',
  };
}

export function buildSelectDom(ctrl) {
  ctrl.wrapper = document.createElement('div');
  ctrl.wrapper.className = 'abd-select';
  ctrl.createLabel('abd-select', ctrl.options.label, ctrl.options.id);

  ctrl.field = document.createElement('select');
  ctrl.field.className = 'abd-select__field';
  if (ctrl.options.id) ctrl.field.id = ctrl.options.id;
  ctrl.wrapper.appendChild(ctrl.field);

  ctrl.notes = ctrl.createNotes('abd-select', (index) => ctrl.field.options[index]);
  ctrl.fieldNoteId = null;

  ctrl.entries.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = `${index}`;
    option.textContent = entry.label;
    ctrl.field.appendChild(option);
    ctrl.notes.wire(index, entry.note);
  });

  ctrl.container.appendChild(ctrl.wrapper);
}

export function applyFieldNote(field, prevNoteId, noteId) {
  const hostIds = (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '' && id !== prevNoteId);

  if (noteId != null) hostIds.push(noteId);
  if (hostIds.length > 0) field.setAttribute('aria-describedby', hostIds.join(' '));
  else field.removeAttribute('aria-describedby');
  return noteId ?? null;
}

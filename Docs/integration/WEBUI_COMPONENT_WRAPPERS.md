# ABDMS2000 — SharedAssets Component Wrappers

Wrapper layer adapting `@abdsynths/shared/components` (0..1 normalized, index-based) to MS2000 conventions (0..127 MIDI/APVTS, `paramStore` + `bridge` binding).

All wrappers live in `src/components/shared/` and are exported from `src/components/shared/index.js`.

---

## Common Patterns

| Aspect | SharedAssets | MS2000 Wrapper |
|--------|-------------|----------------|
| Value model | 0..1 normalized / index | 0..127 (MIDI/APVTS) |
| Conversion | — | `toNorm(val)` / `fromNorm(norm)` |
| paramStore | No | Auto-register on construct, unregister on destroy |
| bridge | No | `bridge.setParam(paramId, val)` on user edits |
| onChange | User edits only | Fires with real 0..127 value + paramId |
| setValue() | Silent (no onChange) | Silent by default, `notify=true` fires onChange |

---

## ABDKnob

```js
import { ABDKnob } from './components/shared/index.js';

new ABDKnob(container, {
  paramId: 'filterCutoff',     // required for paramStore/bridge sync
  label: 'CUTOFF',             // label text
  min: 0,                      // default 0
  max: 127,                    // default 127
  defaultValue: 64,            // default 64
  step: 1,                     // default 1 (quantization)
  size: 48,                    // default 48px
  isBipolar: false,            // default false (center = 0, ± display)
  displayFormatter: (v) => `${Math.round(v)} Hz`, // optional
  skin: 'ms2000',              // default 'ms2000'
  onChange: (val, paramId) => { /* optional extra */ },
  onDragStart: () => {},       // optional
  onDragEnd: () => {},         // optional
});
```

**Methods:**
- `setValue(val, notify=false)` — programmatic update (0..127)
- `getValue()` → 0..127
- `destroy()` — cleanup paramStore registration

---

## ABDSlider

```js
import { ABDSlider } from './components/shared/index.js';

new ABDSlider(container, {
  paramId: 'filterCutoff',
  label: 'CUTOFF',
  min: 0,
  max: 127,
  defaultValue: 64,
  step: 1,
  orientation: 'vertical',     // 'vertical' | 'horizontal'
  length: 80,                  // track length in px (default: 80v / 160h)
  skin: 'ms2000',              // 'ms2000' enables filmstrip fader
  // Filmstrip options (for skin 'ms2000'):
  spriteUrl: 'assets/ST_Fader_58x107_128.png',
  frameWidth: 58,
  frameHeight: 107,
  frames: 128,
  onChange: (val, paramId) => {},
  onDragStart: () => {},
  onDragEnd: () => {},
});
```

**Methods:** same as ABDKnob

---

## ABDFilmstripFader

The MS2000-style fader: fixed viewport, scrolling filmstrip sprite (like physical fader).

```js
import { ABDFilmstripFader } from './components/shared/index.js';

new ABDFilmstripFader(container, {
  paramId: 'mixOsc1Level',
  label: 'OSC 1',
  min: 0,
  max: 127,
  defaultValue: 127,
  step: 1,
  orientation: 'vertical',     // 'vertical' | 'horizontal'
  // Required:
  spriteUrl: 'assets/ST_Fader_58x107_128.png',
  frameWidth: 58,
  frameHeight: 107,
  frames: 128,
  viewportWidth: 36,           // visible window width
  viewportHeight: 80,          // visible window height
  onChange: (val, paramId) => {},
  onDragStart: () => {},
  onDragEnd: () => {},
});
```

**Methods:** same as ABDKnob

---

## ABDSelect

For simple lists (≤10 items, no search/categories). Uses native `<select>`.

```js
import { ABDSelect } from './components/shared/index.js';

new ABDSelect(container, {
  paramId: 'osc1Wave',
  label: 'WAVE',
  options: ['SAW', 'SQUARE', 'TRIANGLE', 'SINE', 'VOX', 'DWGS', 'NOISE', 'AUDIO IN'],
  // or: [{ label: 'SAW', disabled: false, note: '' }, ...]
  id: 'select-osc1Wave',       // optional, for <label for>
  disabled: [],                // indices or (entry, idx) => bool
  skin: 'ms2000',
  onChange: (val, paramId) => {},
});
```

**Methods:**
- `setValue(idx, notify=false)` — programmatic (index)
- `getValue()` → index
- `setDisabled(spec)` — update disabled options dynamically
- `isDivergent()` → true if current value is on disabled option
- `destroy()`

---

## ABDSegmented

For button groups with icons (glyphs). Maps MS2000 `iconSvg` → SharedAssets `glyph`.

```js
import { ABDSegmented } from './components/shared/index.js';

new ABDSegmented(container, {
  paramId: 'filterType',
  label: 'FILTER',
  options: [
    { value: 0, label: 'LPF 24dB', iconSvg: FILTER_ICONS.lpf24 },
    { value: 1, label: 'LPF 12dB', iconSvg: FILTER_ICONS.lpf12 },
    { value: 2, label: 'BPF 12dB', iconSvg: FILTER_ICONS.bpf12 },
    { value: 3, label: 'HPF 12dB', iconSvg: FILTER_ICONS.hpf12 },
  ],
  variant: 'strip',            // 'strip' (default) | 'led'
  size: 'md',                  // 'sm' | 'md' | 'lg'
  skin: 'ms2000',
  disabled: [],                // indices or (entry, idx) => bool
  onChange: (val, paramId) => {},
});
```

**Value mapping:** MS2000 uses arbitrary `value` (0..N), wrapper maps to/from SharedAssets index.

**Methods:**
- `setValue(val, notify=false)` — programmatic (real value, e.g. 2)
- `getValue()` → real value (e.g. 2)
- `setDisabled(spec)` — update disabled options
- `isDivergent()` → true if current value on disabled option
- `destroy()`

---

## ABDToggle

Wraps native checkbox with paramStore/bridge binding.

```js
import { ABDToggle } from './components/shared/index.js';

new ABDToggle(container, {
  paramId: 'portamentoOn',
  onChange: (val, paramId) => {},
});
```

**Methods:**
- `setValue(val, notify=false)` — `val > 0.5` → checked
- `getValue()` → 0 or 1
- `destroy()`

---

## Icons (WAVE_ICONS, FILTER_ICONS)

Available from `@abdsynths/shared/components`:

```js
import { WAVE_ICONS, FILTER_ICONS } from '@abdsynths/shared/components';

// WAVE_ICONS: saw, square, triangle, sine, vox, dwgs, noise, audioIn, sh
// FILTER_ICONS: lpf24, lpf12, bpf12, hpf12
```

Each is an inline SVG string using `currentColor` for theming.

---

## Theme Integration

```js
import { ThemeSwitcher } from '@abdsynths/shared/components';
import { MS2000_THEMES } from '../contracts/themes.js';

const ts = new ThemeSwitcher(host, {
  themes: MS2000_THEMES,        // [{id, label, bodyClass, payload}]
  variant: 'select',            // 'buttons' | 'select'
  onChange: (mode, modeIdx) => {
    paramStore.set('synthMode', modeIdx);
    bridge.setParam('synthMode', modeIdx);
  },
});
```

`MS2000_THEMES`:
```js
[
  { id: 'ms2000', label: 'MS2000', bodyClass: 'skin-ms2000', payload: 0 },
  { id: 'microkorg', label: 'microKORG', bodyClass: 'skin-microkorg', payload: 1 },
  { id: 'advanced', label: 'ADVANCED', bodyClass: 'skin-cyberpunk', payload: 2 },
]
```

---

## Enhance Range Inputs (legacy `<input type="range">`)

```js
import { enhanceRangeInputs } from '@abdsynths/shared/utils';

enhanceRangeInputs(document.body, {
  spriteUrl: 'assets/ST_Fader_58x107_128.png',
  frameWidth: 58,
  frameHeight: 107,
  frames: 128,
  orientation: 'vertical',       // default
});
```

Each `<input type="range">` can override via `data-*`:
- `data-sprite-url`, `data-frame-width`, `data-frame-height`, `data-frames`
- `data-orientation="vertical"`, `data-viewport-width`, `data-viewport-height`
- `data-label`, `data-unit`
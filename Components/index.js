/**
 * ABDShared — Barrel raíz de componentes WebUI interactivos
 * ========================================================
 */

export {
  LiveSysExInspector,
  createLiveSysExInspector,
  decodeSysExHeader,
  toHexByte,
} from './LiveSysExInspector/index.js';

export {
  computeFit,
  mountFitStage,
} from './FitStage/index.js';

export {
  createOverlayFocus,
  focusableWithin,
} from './OverlayFocus/index.js';

export {
  AboutDialog,
  createAboutDialog,
} from './AboutDialog/index.js';

export {
  SynthNavBar,
  createSynthNavBar,
  DEFAULT_NAVBAR_MENUS,
  isItemChecked,
  renderMenuItemHtml,
} from './SynthNavBar/index.js';

export {
  createLcdScreen,
  createLcdMachine,
  createLcdPanel,
  formatValue,
  SevenSegmentDisplay,
} from './LcdDisplay/index.js';

export {
  attachDrag,
  Knob,
  Slider,
  Select,
  Segmented,
  Switch,
  Toggle,
  Wheel,
  XYPad,
  NumberBox,
  FilmstripFader,
  SilverFilmstripKnob,
  EffectLEDButton,
  PeakLED,
  TapeEchoVisual,
  sameControlValue,
  transitioned,
  announceTransition,
  announceMovement,
  announceSettled,
  createContinuousNotices,
  registerSkin,
  getSkin,
  applySkin,
  skinNames,
} from './Controls/index.js';

export {
  DEFAULT_ENVELOPE,
  ENVELOPE_SEGMENTS,
  ENVELOPE_VIEWBOX,
  NEEDLE_FLOOR,
  createEnvelopeCurve,
  envelopeAreaPath,
  envelopeLinePath,
  envelopeNeedlePath,
  envelopePoints,
  EnvelopePad,
} from './Envelopes/index.js';

export {
  createDrawer,
} from './Drawer/index.js';

export {
  ModMatrix,
} from './ModMatrix/index.js';

export {
  ThemeSwitcher,
  FX_THEME_TOKENS,
  registerFxTheme,
  getFxTheme,
  getNeutralFxTheme,
  fxThemeNames,
  fxThemeStyle,
  buildFxThemeIndex,
} from './Theme/index.js';

export {
  WAVE_ICONS,
  FILTER_ICONS,
  WAVEFORM_GLYPHS,
  WAVEFORM_NAMES,
  waveformName,
} from './Icons/index.js';





/**
 * ABDShared — Components/SynthEngines/index.js
 * Public barrel for embeddable WebUI sound engine panels & host slot registry.
 * Importing this barrel registers built-in panels (e.g. 'structured_rompler').
 */

export {
  registerEnginePanel,
  getEnginePanelFactory,
  listRegisteredEnginePanels,
  mountEnginePanel,
  EnginePanelHost,
  DEFAULT_ENGINE_METADATA,
  registerEngineMetadata,
  getEngineMetadata,
  renderEngineCoverHtml,
} from './enginePanelRegistry.js';

export { GenericEnginePanel, createGenericEnginePanel } from './genericEnginePanel.js';
export {
  UNIFIED_COMMON_SPECS,
  UNIFIED_SECTIONS,
  ENGINE_DRAWER_CAPABILITIES,
  resolveUnifiedEngineControls,
  getEngineDrawerCapabilities,
} from './Common/unifiedEngineControlSpecs.js';

export {
  StructuredRomplerPanel,
  createStructuredRomplerPanel,
  createJv880EnginePanel,
} from './StructuredRompler/structuredRomplerPanel.js';

export {
  JV880_FACTORY_NAMES,
  JV880_WAVE_NAMES,
  parseJv880SyxBuffer,
  encodeJv880PatchToDt1Syx,
} from './StructuredRompler/jv880SysexCodec.js';

export { createJv880BrowserBridge } from './StructuredRompler/jv880SysexBankStore.js';

export {
  Mcs48EnginePanel,
  createMcs48EnginePanel,
} from './Mcs48/Mcs48EnginePanel.js';
export {
  La50EnginePanel,
  createLa50EnginePanel,
} from './LinearArithmetic/La50EnginePanel.js';
export {
  Tb303EnginePanel,
  createTb303EnginePanel,
} from './Tb303/Tb303EnginePanel.js';
export {
  TB303_WAVE_OPTIONS,
  TB303_DRIVE_OPTIONS,
  TB303_PARAMETERS_SPEC,
  TB303_PARAM_LOOKUP,
  TB303_FACTORY_PRESETS,
  tb303NormToDomain,
  tb303DomainToNorm,
  tb303WireToDomain,
  tb303DomainToWire,
} from './Tb303/tb303ParamSpecs.js';

export {
  EmaxEnginePanel,
  createEmaxEnginePanel,
} from './Emax/EmaxEnginePanel.js';

export {
  EmaxMenuView,
  createEmaxMenuView,
} from './Emax/emaxMenuView.js';

export {
  EMAX_PARAMETERS_SPEC,
  EMAX_PARAM_LOOKUP,
  EMAX_MENU_PAGES,
  EMAX_TELEMETRY_KEYS,
  EMAX_FACTORY_PRESETS,
  emaxWireToNorm,
  emaxNormToWire,
  emaxNormToPhysicalDomain,
} from './Emax/emaxParamSpecs.js';

export {
  Mcs48ToolbarView,
} from './Mcs48/mcs48ToolbarView.js';

export {
  MCS48_PARAMETERS_SPEC,
  MCS48_PARAM_LOOKUP,
  MCS48_VOICE_PARAMS,
  MCS48_TELEMETRY_KEYS,
} from './Mcs48/mcs48ParamSpecs.js';

export {
  ROMPLER_I18N,
  ROMPLER_PARAM_SPECS,
  ROMPLER_STRUCTURES,
  ROMPLER_SOURCES,
  ROMPLER_FILTER_MODELS,
  ROMPLER_FILTER_MODES,
  ROMPLER_LFO_SHAPES,
  ROMPLER_DRUM_TRIGGERS,
  ROMPLER_DRUM_QUICK_NOTES,
} from './StructuredRompler/romplerParamSpecs.js';

export {
  EngineHeaderBar,
} from './Common/engineHeaderBar.js';

export {
  EnginePresetBrowser,
} from './Common/enginePresetBrowser.js';

export {
  userPresetsStore,
  restorePresetWaves,
  normalizeHartmannCategory,
  getHartmannCategoryInfo,
  listHartmannCategories,
} from './Common/engineUserPresetsStore.js';

export {
  RomplerWavePicker,
} from './StructuredRompler/romplerWavePicker.js';

export {
  flattenRomplerStateJson,
  buildDefaultRomplerFlatState,
  extractRomplerPatchMeta,
} from './StructuredRompler/romplerStateFlatten.js';

export {
  renderCoverArtHtml,
  showCoverHoverPopover,
  hideCoverHoverPopover,
  openCoverModal,
  closeCoverModal,
  closeAllCoverPopups,
  attachCoverPopup,
} from '../CoverPopup/coverPopup.js';


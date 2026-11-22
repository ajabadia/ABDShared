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
  StructuredRomplerPanel,
  createStructuredRomplerPanel,
} from './StructuredRompler/structuredRomplerPanel.js';

export {
  Mcs48EnginePanel,
  createMcs48EnginePanel,
} from './Mcs48/Mcs48EnginePanel.js';

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
  flattenRomplerStateJson,
  buildDefaultRomplerFlatState,
} from './StructuredRompler/romplerStateFlatten.js';


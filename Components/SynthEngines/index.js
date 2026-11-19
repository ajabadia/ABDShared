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


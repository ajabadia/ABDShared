/**
 * ABDScope Theme Module
 * ======================
 * Host-driven theme cascade adapted to the WebUI standalone embed.
 * "Import" here is schematic: in the real embed the generated CSS is a static
 * file (WebUI/src/theme.generated.css) produced at development time from
 * ABDSharedAssets/styles/themes/*.css plus the component adapter
 * ABDSharedAssets/styles/components/scope.css, and committed alongside the
 * module. The module itself does not read from disk at runtime.
 *
 * Kept in sync by the parity test in WebUI/tests/theme.test.js, which compares
 * the generated file against the canonical sources after BOM/CRLF normalization
 * and auto-skips when ABDSharedAssets is not present.
 */

export const THEME_NAMES = [
  'ms2000',
  'cz101',
  'deepmind',
  'audiolab',
  'audiolab-light'
];

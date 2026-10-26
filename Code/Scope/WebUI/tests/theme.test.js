import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Walk up until a sibling ABDSharedAssets appears. A fixed '../../..' only
// works when this repo sits at the suite root (standalone ABDScope); inside
// ABDSharedCode/Scope it lands on ABDSharedCode, where ABDSharedAssets does not
// exist — and the parity suite below would describe.skip in silence, which is
// worse than failing: the guard would still report green.
const findAssetsRoot = (start) => {
  // 1. Direct relative path within consolidated ABDShared repo
  const localAssets = resolve(start, '../../../../Assets');
  if (existsSync(resolve(localAssets, 'styles', 'themes'))) return localAssets;

  // 2. Walk up to workspace root and check ABDShared/Assets or ABDSharedAssets
  let dir = start;
  for (let i = 0; i < 12; i++) {
    const abdSharedAssets = resolve(dir, 'ABDShared', 'Assets');
    if (existsSync(resolve(abdSharedAssets, 'styles', 'themes'))) return abdSharedAssets;
    const legacyAssets = resolve(dir, 'ABDSharedAssets');
    if (existsSync(resolve(legacyAssets, 'styles', 'themes'))) return legacyAssets;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
};

const ABS_ASSETS = findAssetsRoot(here);
const THEMES_DIR = ABS_ASSETS ? resolve(ABS_ASSETS, 'styles', 'themes') : null;
const ADAPTER_PATH = ABS_ASSETS ? resolve(ABS_ASSETS, 'styles', 'components', 'scope.css') : null;
const GENERATED_PATH = resolve(here, '../src/theme.generated.css');

const normalize = (css) => css.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();

const hasWorkspace = Boolean(ABS_ASSETS && THEMES_DIR && existsSync(THEMES_DIR) && ADAPTER_PATH && existsSync(ADAPTER_PATH));
const generatedExists = existsSync(GENERATED_PATH);

const readGenerated = () => normalize(readFileSync(GENERATED_PATH, 'utf8'));

const readCanonicalThemes = () => {
  if (!THEMES_DIR || !existsSync(THEMES_DIR)) return [];
  const files = readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.css'))
    .sort();
  return files.map((f) => ({
    file: f.replace(/\.css$/, ''),
    css: normalize(readFileSync(join(THEMES_DIR, f), 'utf8')),
  }));
};

const readAdapter = () => (ADAPTER_PATH && existsSync(ADAPTER_PATH) ? normalize(readFileSync(ADAPTER_PATH, 'utf8')) : '');

describe('theme cascade', () => {
  it('requires the generated file to exist', () => {
    expect(generatedExists).toBe(true);
  });
});

const canonicalSuite = hasWorkspace && generatedExists ? describe : describe.skip;

canonicalSuite('canonical parity with ABDSharedAssets', () => {
  let generated = '';
  let themes = [];
  let adapter = '';

  beforeAll(() => {
    generated = readGenerated();
    themes = readCanonicalThemes();
    adapter = readAdapter();
  });

  it('generated file includes all canonical theme files', () => {
    for (const { file, css } of themes) {
      expect(generated).toContain(`/* canonical: ABDSharedAssets/styles/themes/${file}.css */`);
      expect(generated).toContain(css);
    }
  });

  it('generated file includes the adapter exactly once', () => {
    const adapterMarker = '/* canonical: ABDSharedAssets/styles/components/scope.css */';
    expect(generated).toContain(adapterMarker);
    const idx = generated.indexOf(adapterMarker);
    const afterMarker = generated.slice(idx);
    expect(afterMarker.startsWith(adapterMarker + '\n' + adapter)).toBe(true);
  });

  it('generated file contains no CSS outside canonical sources + adapter', () => {
    for (const { file, css } of themes) {
      expect(generated).toContain(css);
    }
    expect(generated).toContain(adapter);
    expect(generated.split('\n').filter((line) => line.trim().startsWith('/* canonical:')).length).toBe(
      themes.length + 1
    );
  });
});

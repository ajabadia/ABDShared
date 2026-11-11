/**
 * Q2.4 — Guardia de basenames repetidos en Components/
 *
 * Vitest: falla si algún basename (case-insensitive) aparece en dos
 * rutas diferentes bajo Components/ (tanto en raíz como en Controls/).
 * Sirve de guardrail para evitar la duplicación que Q2 soluciona.
 */

import { describe, it, expect } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const COMPONENTS_ROOT = join('Components');
const CONTROLS_DIR = join('Components', 'Controls');

async function walkComponents(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...await walkComponents(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push({
        path: fullPath,
        basename: entry.name,
        relative: fullPath,
      });
    }
  }

  return results;
}

describe('Q2.4 — Sin basenames repetidos en Components/', () => {
  let files;

  beforeAll(async () => {
    const rootFiles = await walkComponents(COMPONENTS_ROOT);
    const controlsFiles = await walkComponents(CONTROLS_DIR);
    files = [...rootFiles, ...controlsFiles];
  });

  it('no debe haber basenames repetidos (case-insensitive) en dos rutas', () => {
    const seen = new Map();

    for (const f of files) {
      const key = f.basename.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key).push(f.relative);
    }

    const duplicates = Array.from(seen.entries())
      .filter(([_, paths]) => paths.length > 1)
      .map(([basename, paths]) => ({
        basename,
        paths,
      }));

    expect(duplicates).toHaveLength(0);
    if (duplicates.length > 0) {
      console.error('Basenames repetidos encontrados:');
      for (const d of duplicates) {
        console.error(`  - "${d.basename}" en: ${d.paths.join(', ')}`);
      }
    }
  });
});
/**
 * Q2.4 — Guardia de basenames repetidos en Components/
 *
 * Vitest: falla si algún basename (case-insensitive) aparece en dos
 * subdirectorios diferentes bajo Components/, ignorando `index.js`, `*.test.js`
 * y las entradas raíz legadas por compatibilidad hacia atrás.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const COMPONENTS_ROOT = join('Components');

async function walkComponentSubdirs(dir, depth = 0) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkComponentSubdirs(fullPath, depth + 1));
    } else if (depth > 0 && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      if (entry.name.toLowerCase() === 'index.js') continue;
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
    files = await walkComponentSubdirs(COMPONENTS_ROOT);
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
      .filter(([, paths]) => paths.length > 1)
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

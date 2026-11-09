/**
 * Guard de capitalización de imports relativos.
 *
 * En NTFS `./Knob.js` y `./knob.js` apuntan al mismo fichero, así que un
 * specifier con la capitalización equivocada pasa desapercibido en Windows y
 * revienta con `ERR_MODULE_NOT_FOUND` en Linux, macOS o CI.
 *
 * Este test compara el nombre que pide cada import con el que existe en disco,
 * carácter a carácter. No resuelve módulos: solo mira el directorio.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, basename, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'SDKs', 'dist', 'coverage']);
const CODE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'];

/** `from 'x'`, `import 'x'` e `import('x')`; cubre también `export … from 'x'`. */
const SPECIFIER = /(?:from|import)\s*\(?\s*(['"])(\.[^'"]+)\1/g;

function isCodeFile(name) {
  return CODE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('build')) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else if (isCodeFile(entry)) out.push(full);
  }
  return out;
}

/** Devuelve el nombre real del fichero o `null` si el caso ya es correcto. */
function realNameFor(dir, requested) {
  if (!statSync(dir).isDirectory()) return null;
  const entries = readdirSync(dir);
  if (entries.includes(requested)) return null;
  return entries.find((entry) => entry.toLowerCase() === requested.toLowerCase()) ?? null;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

describe('capitalización de imports relativos', () => {
  it('cada specifier coincide con el nombre del fichero en disco', () => {
    const problems = [];

    for (const file of walk(ROOT)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(SPECIFIER)) {
        const specifier = match[2];
        const targetDir = dirname(resolve(dirname(file), specifier));
        const requested = basename(specifier);

        let realName = null;
        try {
          realName = realNameFor(targetDir, requested);
        } catch {
          continue; // el directorio no existe: lo dirá el resolutor, no este guard
        }
        if (!realName) continue;

        problems.push(
          `${relative(ROOT, file).split(sep).join('/')}:${lineOf(source, match.index)} ` +
            `pide '${specifier}' y el fichero es '${realName}'`,
        );
      }
    }

    expect(problems).toEqual([]);
  });
});

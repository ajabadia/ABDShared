// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ABDNeuModMakr â€” sfArk WebAssembly SoundFont Decompressor
// Encapsulated sfArkLib v3.00 WebAssembly engine for Node and Web
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { createSfArkModule, type SfArkEmscriptenModule } from './sfarkEngine.js';

let cachedModulePromise: Promise<SfArkEmscriptenModule> | null = null;

function getModule(): Promise<SfArkEmscriptenModule> {
  if (cachedModulePromise) {
    return cachedModulePromise;
  }
  cachedModulePromise = new Promise<SfArkEmscriptenModule>((resolve, reject) => {
    try {
      const mod = createSfArkModule({
        noInitialRun: true,
        onRuntimeInitialized() {
          resolve(mod);
        },
      });
    } catch (err) {
      cachedModulePromise = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  return cachedModulePromise;
}

export function isSfArkBuffer(data: Uint8Array): boolean {
  if (data.length < 32) return false;
  // Standard sfArk signature at offset 26: 'sfArk'
  if (
    data[26] === 0x73 &&
    data[27] === 0x66 &&
    data[28] === 0x41 &&
    data[29] === 0x72 &&
    data[30] === 0x6B
  ) {
    return true;
  }
  // Check self-extracting archives (up to 128 KB search)
  const limit = Math.min(data.length - 5, 131072);
  for (let i = 0; i < limit; i++) {
    if (
      data[i] === 0x73 &&
      data[i + 1] === 0x66 &&
      data[i + 2] === 0x41 &&
      data[i + 3] === 0x72 &&
      data[i + 4] === 0x6B
    ) {
      return true;
    }
  }
  return false;
}

let fileCounter = 0;

export async function decompressSfArk(data: Uint8Array): Promise<Uint8Array> {
  if (!isSfArkBuffer(data)) {
    throw new Error('Not a valid sfArk archive');
  }
  const mod = await getModule();
  const id = ++fileCounter;
  const inPath = `/sfark_${id}.sfark`;
  const outPath = `/sfark_${id}.sf2`;

  try {
    mod.FS.writeFile(inPath, data);
    const code = mod.ccall(
      'load_file',
      'number',
      ['string', 'string', 'number'],
      [inPath, outPath, data.length]
    );

    const exists = mod.FS.analyzePath(outPath).exists;
    if (!exists) {
      throw new Error(`sfArk decompression failed (code ${code})`);
    }

    const outData = mod.FS.readFile(outPath);
    return new Uint8Array(outData.buffer, outData.byteOffset, outData.byteLength);
  } finally {
    try {
      if (mod.FS.analyzePath(inPath).exists) mod.FS.unlink(inPath);
    } catch {
      // ignore cleanup error
    }
    try {
      if (mod.FS.analyzePath(outPath).exists) mod.FS.unlink(outPath);
    } catch {
      // ignore cleanup error
    }
  }
}

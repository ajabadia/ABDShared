export interface EmscriptenFS {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string, opts?: { encoding: string }): Uint8Array;
  unlink(path: string): void;
  analyzePath(path: string): { exists: boolean };
}
export interface SfArkEmscriptenModule {
  FS: EmscriptenFS;
  ccall(ident: string, returnType: string | null, argTypes: string[], args: unknown[]): number;
}
export declare function createSfArkModule(moduleOverrides?: Record<string, unknown>): SfArkEmscriptenModule;

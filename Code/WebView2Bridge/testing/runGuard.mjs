#!/usr/bin/env node
/**
 * Runner del guard de dirección del canal WebView2 — implementación ÚNICA de la suite.
 *
 * Cada host solo aporta su configuración (árbol a escanear y ficheros que emiten); la
 * lógica y el formato de salida viven aquí, junto al módulo del guard. Así el CI de
 * todos los proyectos lanza el mismo comando y no hay runners copiados por repo.
 *
 * Uso:
 *   node Code/WebView2Bridge/testing/runGuard.mjs \
 *        --source <dir> [--emitters "a.cpp,b.h"] [--expect-host f.cpp] [--label Nombre]
 *
 *   --source       árbol C++ del host (obligatorio)
 *   --emitters     emisores nativo → JS declarados, separados por comas
 *   --expect-host  fichero que debe detectarse como host del WebView (red de seguridad
 *                  para no dar verde escaneando un árbol equivocado)
 *   --label        nombre del proyecto en la salida
 *
 * Sale con 0 si el canal está bien y con 1 si hay cualquier problema.
 */
import path from 'node:path';

import { checkBridgeDirection, formatFindings } from './webviewBridgeDirection.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq >= 0) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = '';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.source) {
  console.error('[guard webview2] falta --source <directorio C++ del host>');
  process.exit(2);
}

const emitters = (args.emitters ?? '')
  .split(',')
  .map(entry => entry.trim())
  .filter(Boolean);
const label = args.label || path.basename(path.resolve(args.source, '..'));
const expectHost = args['expect-host'];

let result;
try {
  result = checkBridgeDirection({ sourceRoot: args.source, emitters });
} catch (error) {
  console.error(`[guard webview2] ${label}: ${error.message}`);
  process.exit(2);
}

console.log(`[guard webview2] ${label}: ${result.scanned} fuentes C++ en ${args.source}`);
console.log(`[guard webview2] ${formatFindings(result)}`);
console.log(
  `[guard webview2] hosts: ${result.webViewHosts.join(', ') || '(ninguno)'} | ` +
    `emisores: ${emitters.join(', ') || '(ninguno)'}`
);

let ok = result.ok;

// Escanear un árbol equivocado daría un verde sin valor: si se declara un host
// esperado, tiene que aparecer.
if (expectHost && !result.webViewHosts.includes(expectHost)) {
  console.error(
    `[guard webview2] ${label}: no detecté ${expectHost} como host del WebView; ` +
      `¿se está escaneando el árbol correcto?`
  );
  ok = false;
}

process.exit(ok ? 0 : 1);

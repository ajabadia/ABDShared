/**
 * Autotest del guard de dirección del canal WebView2 (ABDShared).
 *
 * El módulo vive aquí y lo consumen todos los hosts de la suite, pero este repo no
 * tenía ninguna comprobación sobre él: sus pruebas de comportamiento estaban solo en
 * ABDMS2000. Esto le da CI propia, sin dependencias (solo `node --test`), para que un
 * cambio en el guard no llegue a los hosts sin verificarse antes en su casa.
 *
 * Uso:  node --test Code/WebView2Bridge/testing/webviewBridgeDirection.selftest.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FORBIDDEN_CALL,
  REQUIRED_CALL,
  checkBridgeDirection,
  findForbiddenLines,
  findWebViewHosts,
  formatFindings,
  stripCppComments
} from './webviewBridgeDirection.js';

/** Fichero C++ que crea el componente web y emite por el canal correcto. */
const GOOD_HOST = [
  'webComponent = std::make_unique<juce::WebBrowserComponent>(options);',
  'webComponent->emitEventIfBrowserIsVisible("state", obj);',
  ''
].join('\n');

/** Crea un árbol C++ temporal y devuelve su raíz. */
function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-selftest-'));
  for (const [relative, source] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, 'utf8');
  }
  return root;
}

test('el comentario que documenta el fallo no dispara el guard', () => {
  assert.equal(stripCppComments(`// ${FORBIDDEN_CALL}('evt', x)`).includes(FORBIDDEN_CALL), false);
  assert.equal(stripCppComments('auto u = "https://juce.backend/x";').includes('https://juce.backend/x'), true);
  assert.deepEqual(findForbiddenLines(`// ${FORBIDDEN_CALL}\nok();\n`), []);
});

test('el canal equivocado escrito desde C++ se reporta con su línea', () => {
  const root = makeTree({
    'Plugin/Host.cpp': `void f() {\n  browser.evaluateJavascript("window.__JUCE__.${FORBIDDEN_CALL}('state', j);");\n}\n`
  });

  const result = checkBridgeDirection({ sourceRoot: root, emitters: [] });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [{ file: path.join('Plugin', 'Host.cpp'), lines: [2] }]);
  assert.match(formatFindings(result), /Host\.cpp:2 usa backend\.emitEvent desde C\+\+/);
});

test('se detecta el host del WebView, pero un host mudo no rompe el veredicto', () => {
  const root = makeTree({
    'Plugin/Host.cpp': 'view = std::make_unique<juce::WebBrowserComponent>(options);\n'
  });

  assert.deepEqual(findWebViewHosts(root), ['Plugin/Host.cpp']);

  // Host que nunca emite (ABDAxionikVS responde con su propia API de página):
  // no hay canal nativo → JS que exigir, así que el veredicto es verde.
  const result = checkBridgeDirection({ sourceRoot: root, emitters: [] });

  assert.equal(result.ok, true);
  assert.deepEqual(result.webViewHosts, ['Plugin/Host.cpp']);
  assert.deepEqual(result.undeclaredEmitters, []);
});

test('un emisor sin declarar se reporta aunque no haya nada prohibido', () => {
  const root = makeTree({ 'Plugin/Host.cpp': GOOD_HOST });

  const result = checkBridgeDirection({ sourceRoot: root, emitters: [] });

  assert.equal(result.ok, false);
  assert.deepEqual(result.undeclaredEmitters, ['Plugin/Host.cpp']);
  assert.match(formatFindings(result), new RegExp(`no está declarado en emitters`));
});

test('declarar el emisor deja el veredicto en verde', () => {
  const root = makeTree({
    'Plugin/Host.cpp': GOOD_HOST,
    // Configurar opciones no convierte a un fichero en host (caso ABDEep) y, sin
    // emitir, tampoco lo convierte en emisor.
    'Plugin/NativeFunctions.cpp': 'juce::WebBrowserComponent::Options addOptions (juce::WebBrowserComponent::Options o);\n'
  });

  const result = checkBridgeDirection({ sourceRoot: root, emitters: ['Plugin/Host.cpp'] });

  assert.equal(result.ok, true);
  assert.deepEqual(result.webViewHosts, ['Plugin/Host.cpp']);
  assert.deepEqual(result.undeclaredEmitters, []);
  assert.match(formatFindings(result), /^OK/);
});

test('un emisor declarado que deja de usar la API correcta se reporta', () => {
  const root = makeTree({ 'Plugin/Host.cpp': 'void f() {}\n' });

  const result = checkBridgeDirection({ sourceRoot: root, emitters: ['Plugin/Host.cpp'] });

  assert.deepEqual(result.missingEmitters, ['Plugin/Host.cpp']);
  assert.equal(result.ok, false);
  assert.match(formatFindings(result), new RegExp(REQUIRED_CALL));
});

test('un emisor declarado que ya no existe se reporta', () => {
  const root = makeTree({ 'Plugin/Host.cpp': GOOD_HOST });

  const result = checkBridgeDirection({ sourceRoot: root, emitters: ['Plugin/Borrado.cpp'] });

  assert.deepEqual(result.absentEmitters, ['Plugin/Borrado.cpp']);
  assert.equal(result.ok, false);
});

test('sin sourceRoot avisa en vez de aprobar por defecto', () => {
  assert.throws(() => checkBridgeDirection({}), /sourceRoot/);
});

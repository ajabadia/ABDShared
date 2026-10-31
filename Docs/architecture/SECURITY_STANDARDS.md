# Estándares de Seguridad ABDSynths — Todos los proyectos

> **Ámbito:** todo software ABDSynths (apps web, bridges locales Python, formatos, plugins JUCE/C++).
> **Origen:** auditoría 2026-10-30 de ABDNeuModMakr (XSS, SSRF, path traversal, DoS ZIP/sesión).
> **Ubicación canónica:** `ABDShared/Docs/architecture/SECURITY_STANDARDS.md`. Los proyectos pueden espejarlo en su `DOCS/SECURITY_STANDARDS.md`; no se versiona dentro de `vendor/`.
> **No encajaba en ningún doc existente** (los de `architecture/` cubren calidad VST3, DSP thread-safety, headless, i18n, catálogo — ninguno es normativa de seguridad app/web) → documento nuevo.

---

## 1. Principios

1. **Validar en la frontera, escapar en la salida.** Todo payload externo (JSON de sesión/bank, `localStorage`, ZIP/SF2/SFZ/WAV, `manifest.json`, respuestas del bridge/companion) se valida con schema estricto antes de usarse; todo string que llegue a `innerHTML`/atributo/SQL/ruta se escapa o rechaza.
2. **Allowlist, nunca denylist.** URLs, rutas, MIME, extensiones y protocolos solo pasan si están en lista explícita.
3. **El cliente es atacante.** `localStorage`/`IndexedDB` se tratan como entrada no confiable (editable en DevTools).
4. **El bridge/companion local es un servidor.** Aunque escuche en `127.0.0.1`, cualquier web puede llamarlo vía CORS → requiere auth + origen estricto + canonización de rutas.
5. **Presupuesto de recursos.** Todo parser tiene caps de tamaño/nº entradas/tiempo con test de regresión (referencia: `phase7_import_robustness` en NeuModMakr).

## 2. Frontend (XSS / inyección)

- [ ] **S2.1** Nunca `eval`, `new Function`, `setTimeout(string)`, `document.write`. Verificado con grep en CI.
- [ ] **S2.2** Todo `innerHTML` con datos externos usa escape central (`escHtml/escAttr`). Texto puro → `textContent`.
- [ ] **S2.3** El escape de atributos NO basta para URLs. `<img src>` / `<a href>` / `fetch` solo aceptan: `data:image/webp;base64,`, `data:image/png;base64,`, `blob:`, `https:` explícito. Rechazar `javascript:`, `data:text/html`, `data:image/svg+xml`.
- [ ] **S2.4** Nombres/archivos (`file.name`, nombres de modelo/sample, `originalName`) con longitud máxima y charset restringido, sin `<>\"'&`.
- [ ] **S2.5** Claves API (BYOK) solo en `localStorage`, `input type="password"`, jamás en logs/URL/telemetría.

## 3. Sesión / persistencia

- [ ] **S3.1** Un único validador por tipo (sesión, bank, manifest). Nada de `JSON.parse` directo a estado sin schema.
- [ ] **S3.2** Cotas obligatorias (ajustar por proyecto, estos son los valores de referencia):

| campo | límite |
|---|---|
| `id` | 1..128, `^[A-Za-z0-9-_]+$` |
| `name/modelName` | 1..64 (11 en hardware clásico) |
| `sampleLow/High/sampleName` | ≤256, sin `..` ni ruta absoluta |
| `originalName` | ≤128 |
| `webpDataUrl` | prefijo `data:image/webp;base64,` + `length ≤ 700_000` (~512 KB) |
| `aiBridgeEndpoint` | ver S4.1 |
| `zones/extendedRegions` | ≤128 / ≤256 |

- [ ] **S3.3** `byteLength/width/height` se recalculan, nunca se confía en el declarado. `width/height 1..2048`.
- [ ] **S3.4** `JSON.parse` siempre en `try`, error genérico al usuario (sin volcar payload).

## 4. SSRF / red

- [ ] **S4.1** Toda URL configurable (`aiBridgeEndpoint`, URL del bridge, `models/url`) valida con `new URL()`: solo `http:/https:`, longitud ≤500, bloquea `169.254.0.0/16`, `10/8`, `172.16/12`, `192.168/16`, `0.0.0.0`, `*.local`, salvo loopback explícito configurado por el usuario.
- [ ] **S4.2** `fetch` a IA con `AbortController` + timeout + `Content-Length` máximo.
- [ ] **S4.3** Descargas del bridge (`urllib.request.urlopen(url)`): solo `https:` a dominios en allowlist explícita. Sin esto hay SSRF de servidor.

## 5. Bridge / companion Python

- [ ] **S5.1** CORS: nunca `*` con escritura; origen explícito (localhost + dominio prod).
- [ ] **S5.2** Auth mínima: token generado al arrancar exigido en cabecera para `POST /fs/*`, `/models/*`, `/enhance`.
- [ ] **S5.3** Antitraversal: `abspath` + `commonpath(library_path)`; `slug` solo `^[a-z0-9][a-z0-9-_]{0,63}$`; `rel_path` rechaza `..`, absoluto, `~`, `\\`.
- [ ] **S5.4** Límites: `Content-Length` acotado, nº ficheros y tamaño por fichero acotados, respuestas `scan` topadas.
- [ ] **S5.5** Logs sin secretos (cuidado con headers como `X-Text-Prompt`).

## 6. Archivos / formatos (DoS y Zip-Slip)

- [ ] **S6.1** Caps con test: ZIP (nº entradas / bytes por entrada / bytes totales), SFZ (bytes + tope regiones), SF2 (tope presets + `safeRecordCount`), WAV (magia + truncado), import (MB por fichero × nº ficheros).
- [ ] **S6.2** Zip-Slip: rechazar entradas con `..`, ruta absoluta o que tras normalizar escapen de su capa. Mantener filtro `__MACOSX/.DS_Store/._*`.
- [ ] **S6.3** `manifest.json`/`provenance.json` del ZIP se validan por `magic`/`schemaVersion`; el resto se ignora si no casa.
- [ ] **S6.4** `cover.webp` se revalida (cabecera RIFF/WEBP + dimensiones), nunca se confía en la meta del ZIP.

## 7. Service Worker / build

- [ ] **S7.1** El SW solo cachea `GET` mismo-origen, nunca `POST` ni respuestas con `Authorization`. `CACHE_NAME` versionado.
- [ ] **S7.2** `server.fs.allow` mínimo en dev; nunca rutas padre en prod.

## 8. Checklist de aceptación por PR

Todo PR que toque IO externo debe marcar:

- [ ] Suite de robustez en verde (incluye ZIP-bomba, SFZ oversize, XSS-escape).
- [ ] Grep limpio: `eval\(|new Function|document\.write|<script` en frontend; `pickle\.loads|yaml\.load|shell=True|os\.system` en Python.
- [ ] Nuevo campo persistido → cota S3.2 + test de rechazo.
- [ ] Nueva ruta bridge → auth + test traversal `../../`.
- [ ] Nuevo `innerHTML` → escape + test XSS ampliado.

## 9. Tests de regresión mínimos

WAV truncado, SF2 con `subSize` absurdo (<2 s), ZIP bomba (caps), SFZ oversize + tope regiones, escape neutraliza `\"><img onerror>`, SSRF (`http://169.254.169.254/` rechazado), `webpDataUrl` gigante rechazado, `rel_path=../../evil` rechazado.

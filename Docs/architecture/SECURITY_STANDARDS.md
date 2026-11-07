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
- [ ] **S6.5** Ratio de descompresión acotado, además del tamaño absoluto: bytes expandidos ≤ K × bytes en disco (referencia: 20 para ZIP de bancos, 50 para SF2/SFZ con samples comprimidos) y tope absoluto por entrada. Un contenedor que declara samples enormes con datos muy comprimidos agota la memoria antes de que el cap de tamaño de fichero lo detecte.

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

- [ ] El código nativo del puente revalida tipo, rango y longitud de cada payload antes de mapearlo a parámetros o al estado persistido.
- [ ] El cargador de samples dimensiona sus buffers por el tamaño real del fichero, nunca por los metadatos del header.

## 9. Tests de regresión mínimos

WAV truncado, SF2 con `subSize` absurdo (<2 s), ZIP bomba (caps), SFZ oversize + tope regiones, escape neutraliza `\"><img onerror>`, SSRF (`http://169.254.169.254/` rechazado), `webpDataUrl` gigante rechazado, `rel_path=../../evil` rechazado.

---

## 10. Puente nativo C++ ↔ WebView2 (la frontera real)

Sanitizar solo en el frontend no protege nada: con las DevTools de WebView2 abiertas, cualquiera puede llamar a `window.chrome.webview.postMessage()` con un JSON arbitrario y saltarse por completo §2. El puente nativo es la frontera de confianza.

- [ ] **S10.1** El handler nativo (`BridgeActions` / `WebView2Bridge`) valida estructuralmente antes de parsear: objeto, claves en allowlist, tipo por campo, rango numérico contra el `ParameterRegistry`, longitud máxima de strings y tamaño máximo del mensaje.
- [ ] **S10.2** Un valor fuera de rango se recorta o se descarta; nunca llega a `setValueNotifyingHost()` ni al XML de persistencia.
- [ ] **S10.3** Los mensajes desconocidos se ignoran en silencio y se registran sin volcar el payload (S2.5 / S5.5).
- [ ] **S10.4** Un XSS en la UI puede no romper el DSP, pero sí corromper el estado que el DAW guarda y relee: la validación nativa no es opcional.

## 11. Filesystem local: enlaces simbólicos y memoria

- [ ] **S11.1 (corrige S5.3)** `commonpath` sobre `abspath` no protege frente a symlinks: un enlace dentro de la librería que apunta a `/etc/passwd` resuelve como si estuviera dentro. Resolver con `pathlib.Path.resolve(strict=True)` **antes** de validar la pertenencia, y rechazar lo que escape.
- [ ] **S11.2** En C++ la equivalencia es resolver el enlace (`juce::File::getLinkedTarget()`) sobre `getFullPathName()` y comparar con el prefijo canónico de la librería; rechazar también rutas que no existan en disco.
- [ ] **S11.3** Las reservas de memoria para buffers de samples se dimensionan con el tamaño real del fichero (`os.path.getsize()` / `juce::File::getSize()`), nunca con lo declarado en el header: un WAV que declara 4 GB y ocupa 2 KB provoca un OOM DoS si se hace `resize()` antes de leer.
- [ ] **S11.4** El header se valida además por coherencia: nº de canales acotado (≤ 8), `bitsPerSample` en allowlist, chunk `data` que quepa en el fichero real y duración declarada acotada.

### 11.5 Patrón C++ Canónico: Blindaje de `juce::AudioFormatReader` contra Bombas DoS

```cpp
// C++20 - Rutina canónica de carga segura contra bombas DoS de samples
std::unique_ptr<juce::AudioBuffer<float>> loadSampleSafely(
    juce::AudioFormatManager& formatManager,
    const juce::File& file,
    int64_t maxAllowedBytes = 256 * 1024 * 1024) // Techo estricto: 256 MB
{
    // 1. Validar tamaño real en disco antes de tocar el formato
    const auto physicalFileSize = file.getSize();
    if (physicalFileSize <= 0 || physicalFileSize > maxAllowedBytes)
    {
        DBG("Seguridad: Archivo rechazado por tamaño físico no admisible.");
        return nullptr;
    }

    // 2. Abrir lector de formato
    std::unique_ptr<juce::AudioFormatReader> reader(formatManager.createReaderFor(file));
    if (!reader)
        return nullptr;

    // 3. Validar coherencia estructural del header
    if (reader->numChannels == 0 || reader->numChannels > 8 ||
        reader->sampleRate <= 0.0 || reader->sampleRate > 192000.0)
    {
        DBG("Seguridad: Header con canales o frecuencia fuera de límites.");
        return nullptr;
    }

    // 4. Protección contra Bomba DoS (Header falsificado vs. Tamaño real en disco)
    // El tamaño de PCM en memoria no puede superar desproporcionadamente el tamaño físico
    // (factor máximo de descompresión admisible para formatos estándar, ej. ratio 4x)
    const int64_t rawPcmBytesNeeded = reader->lengthInSamples * reader->numChannels * sizeof(float);
    const int64_t maxPlausibleBytes = physicalFileSize * 4 + 1024; // Margen para cabeceras y expansión float

    if (rawPcmBytesNeeded > maxAllowedBytes || rawPcmBytesNeeded > maxPlausibleBytes)
    {
        DBG("Seguridad: Detección de Bomba DoS en sample. Reserva cancelada.");
        return nullptr;
    }

    // 5. Asignación segura con tamaño validado
    auto buffer = std::make_unique<juce::AudioBuffer<float>>(
        static_cast<int>(reader->numChannels),
        static_cast<int>(reader->lengthInSamples));

    reader->read(buffer.get(), 0, static_cast<int>(reader->lengthInSamples), 0, true, true);
    return buffer;
}
```

## 12. Checklist rápida de PR (adiciones 2026-11)

- [ ] El puente C++ descarta y sanitiza cualquier parámetro fuera de rango enviado desde WebView2 (no se confía en la validación de JS).
- [ ] Las rutas del companion se resuelven con `Path.resolve(strict=True)` antes de `commonpath`.
- [ ] El cargador de samples no reserva memoria a partir de los metadatos del header.
- [ ] Los payloads que cruzan un ring buffer SPSC son trivially copyable.
- [ ] Los contenedores (ZIP/SF2/SFZ/WAV) rechazan ratios de descompresión anómalos, no solo tamaños absolutos grandes (S6.5).

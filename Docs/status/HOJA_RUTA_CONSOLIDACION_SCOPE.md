# Seguimiento de consolidacion de Scope (`ABDShared::Scope*`)

> **Tipo:** seguimiento (no normativo) · **Alcance:** estado real de las Fases 2–4 de la consolidacion del modulo Scope.
> **Estado (2026-11-10):** Fases 2–4 ✅ completadas.
> **Decision canonica:** `Code/Scope/docs/EVALUATION_ABDSHAREDCODE_ASSETS.md` §6.
> **Norma aplicable:** `Code/Scope/docs/INTEGRATION_GUIDE.md`, `Code/Scope/HANDOFF.md`.

No duplica la decision ni el roadmap de assets. Es el resumen vivo del estado de ejecucion.

## Fases

### Fase 0 – Decision A1 (completada 2026-09-05)
- `Code/Scope` se adopta como fuente unica de WebUI.
- Registro: `EVALUATION_ABDSHAREDCODE_ASSETS.md` (citado 6 veces desde HANDOFF).

### Fase 1 – Extraccion a `Code/Scope` (completada, v0.3.2)
- Subdirectorio `Code/Scope/Source` con `ABDScopeCore*` y `ABDScopeWebAssets`.
- Alias de compatibilidad `ABDScope::ABDScopeCore` y `ABDScope::ABDScopeWebAssets` (retirados en Fase 4, 2026-11-10).

### Fase 2 – Migracion al proveedor generico WebView2 (completada 2026-11-10)
- `ScopeResourceProvider` ahora es adaptador (~45 lineas): delega en `abd::webview2::webView2ResourceProvider(url, scopeAssetsCatalog())`.
- Eliminado: pipeline propio, tabla MIME propia, busqueda propia.
- `Code/WebView2Bridge/WebView2ResourceProvider` gana un quinto pase (por nombre base de `originalFilenames`), porque `juce_add_binary_data` guarda solo el basename y las rutas anidadas (`/src/mount/MountBase.js`) no resolvian. Superset: solo actua si los pases previos fallan.
- `Code/Scope/Source/CMakeLists.txt`: enlace a `ABDShared::WebView2Bridge` si existe; rama standalone (`elseif(NOT EMSCRIPTEN)`) con include `${CMAKE_CURRENT_SOURCE_DIR}/../..` y fuente `../../WebView2Bridge/WebView2ResourceProvider.cpp`. Eliminado el fallback a `../../../ABDSharedCode`.
- `Code/CMakeLists.txt` §9: alias `ABDShared::ScopeCoreHeaders`, `ABDShared::ScopeCore`, `abd_scope_core` sin guardas `if(TARGET)`; `ABDShared::ScopeWebAssets` condicionado a JUCE.

Verificacion ejecutada:
- Proyecto desechable consumiendo `ABDShared::ScopeCore` por nombre canonico: configure OK, build Release `ScopeProviderVerify` OK con 0 warnings, ejecucion 9/9 OK (`/`, `/index.html`, `/src/scope.css`, `/src/theme.generated.css`, `/src/scope.js`, `/src/mount/MountBase.js`, `/src/renderers/OscilloscopeRenderer.js`; `nullopt` para `/juce.js` y ruta inexistente).
- Configure standalone `cmake -S Code/Scope`: exit 0 (valida rutas de la rama standalone).

### Fase 3 – Registro determinista de targets (completada 2026-11-10)
- [x] Alias `ABDShared::Scope*` sin guardas en `Code/CMakeLists.txt` §9.
- [x] `ABDShared::ScopeCore` ya enlaza `ABDShared::WebView2Bridge` (o sus fuentes en standalone).
- [x] Servicio de WebUI unificado: `ScopeResourceProvider` delega en el puente generico.
- [x] Verificado (2026-11-10): `ABDMS2000` (VS 18 2026, Release) y `ABDAudioLab` (VS 18 2026, Release) compilan enlazando `ABDShared::ScopeCore` / `ABDShared::ScopeCoreHeaders` tras la migracion (ambos recompilan `ScopeResourceProvider.cpp` contra el puente generico sin errores).

### Fase 4 – Alineacion y limpieza (completada 2026-11-10)
- [x] Retirados los alias de compatibilidad `ABDScope::ABDScopeCore` y `ABDScope::ABDScopeWebAssets` (`Code/Scope/CMakeLists.txt`, `Code/Scope/Source/ABDScopeConfig.cmake.in`).
- [x] Superficie publica promovida a `ABDShared::Scope*`.
- [x] Actualizados `Code/Scope/HANDOFF.md` §6, `Code/Scope/ROADMAP.md`, `Code/Scope/ARCHITECTURE_SPEC.md`, `Code/Scope/docs/INTEGRATION_GUIDE.md`, `Code/Scope/docs/EVALUATION_ABDSHAREDCODE_ASSETS.md`, `Docs/status/HOJA_RUTA_CONSOLIDACION_SCOPE.md` y `Docs/status/README.md`.
- [x] Temporales de verificacion borrados. Pendiente fuera de este arbol: archivar `ABDScope.git` como obsoleto en todos los entornos cuando proceda.

## Proximo movimiento
- (Fases 2–4 cerradas.) Accion operativa pendiente: archivar `ABDScope.git` standalone como obsoleto cuando se confirme en todos los entornos.
- Seguimiento funcional del modulo: Fase 5 del roadmap de Scope (integracion en suite / Zero-Copy) segun `Code/Scope/ROADMAP.md`.

## Referencias
- `Code/Scope/docs/EVALUATION_ABDSHAREDCODE_ASSETS.md` (decision A1, fases 2–4 abiertas).
- `Code/Scope/HANDOFF.md` §6.
- `Code/Scope/docs/INTEGRATION_GUIDE.md` §7.3.
- `Code/Scope/docs/USAGE_GUIDE.md`.
- `Code/Scope/Source/JUCE/ScopeResourceProvider.{h,cpp}`.
- `Code/WebView2Bridge/WebView2ResourceProvider.{h,cpp}`.
- `Code/CMakeLists.txt` §9.
- `Code/Scope/Source/CMakeLists.txt`.

# 🛑 Política de Deprecación (Deprecation Policy) — ABDShared

Este documento define la política oficial para marcar y retirar funciones, módulos o arquitecturas obsoletas en la suite **ABD Synths**.

---

## 1. Principio Fundamental
* Ninguna API o componente se elimina sin haber pasado previamente por un ciclo completo de deprecación.
* Todo elemento deprecado debe indicar explícitamente la alternativa recomendada y la versión programada para su remoción.

---

## 2. Patrones de Código

### C++ (`[[deprecated]]`)
```cpp
[[deprecated("Use abd::synth::OscPolyBlep en lugar de la implementación legacy. Se eliminará en v2.0.0")]]
void legacyOscillatorFunction() {
    // Mantener funcionalidad para compatibilidad hacia atrás
}
```

### JavaScript / ES Modules (`console.warn`)
```javascript
export function legacyUiHelper() {
    console.warn(
        '[ABDShared Deprecation] legacyUiHelper() está deprecado. ',
        'Usa createLiveSysExInspector() en su lugar. Se eliminará en la siguiente versión mayor.'
    );
    return newReplacementHelper();
}
```

---

## 3. Ciclo de Vida de Deprecación
1. **Fase de Anuncio (Minor version X.Y.0):**
   * El elemento se marca con `[[deprecated]]` en C++ o `console.warn` en JS.
   * La documentación oficial y el `ROADMAP.md` se actualizan reflejando el estado.
2. **Fase de Transición (X.Y.1 a X.Z.0):**
   * El elemento sigue funcionando al 100% para evitar romper plugins en producción.
   * Los nuevos sintetizadores tienen prohibido invocar APIs deprecadas.
3. **Fase de Eliminación (Major version X+1.0.0):**
   * El código obsoleto se retira por completo del repositorio.

---

## 4. Registro de Elementos en Deprecación Activa

| Elemento | Ubicación Anterior | Sustituto Oficial | Estado / Retirada |
|---|---|---|---|
| **`ABDScope` (Repo Raíz)** | `d:/desarrollos/ABDSynths/ABDScope` | `ABDShared/Code/Scope/` y `ABDShared/Components/Scope/` | 🔴 **Completado.** Archivado en `_Deprecados/ABDScope`. Directorio raíz eliminado. |
| **`ABDSharedCode`** | `d:/desarrollos/ABDSynths/ABDSharedCode` | `ABDShared/Code/` | 🟡 **En transición progresiva.** Migrado en `ABDAudioLab` y `ABDEep`. Activo para `ABDMS2000` y `ABDCZ101`. Se archivará en `_Deprecados/` al finalizar la suite. |
| **`ABDSharedAssets`** | `d:/desarrollos/ABDSynths/ABDSharedAssets` | `ABDShared/Assets/` y `ABDShared/Contracts/` | 🟡 **En transición progresiva.** Migrado en `ABDAudioLab` y `ABDEep`. Activo para `ABDMS2000` y `ABDCZ101`. Se archivará en `_Deprecados/` al finalizar la suite. |
| **`convertSysExToCutoffHz`** | Global | `conversion::normToCutoffHz` | 🔴 Retirado |

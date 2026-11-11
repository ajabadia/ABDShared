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
| **`ABDSharedCode`** | `d:/desarrollos/ABDSynths/ABDSharedCode` | `ABDShared/Code/` | 🟢 **Migración completada en la suite.** Consumido canónicamente por `ABDAudioLab`, `ABDEep`, `ABDCZ101`, `ABDMS2000`, `ABDNeural` y `ABDJUNiO601`. Listo para archivar en `_Deprecados/`. |
| **`ABDSharedAssets`** | `d:/desarrollos/ABDSynths/ABDSharedAssets` | `ABDShared/Assets/` y `ABDShared/Contracts/` | 🟢 **Migración completada en la suite.** Consumido canónicamente por `ABDAudioLab`, `ABDEep`, `ABDCZ101`, `ABDMS2000`, `ABDNeural` y `ABDJUNiO601`. Listo para archivar en `_Deprecados/`. |
| **`convertSysExToCutoffHz`** | Global | `conversion::normToCutoffHz` | 🔴 Retirado |

> **Estado de la documentación (2026-11-10):** toda la documentación del repositorio usa ya las rutas actuales (`Code/`, `Assets/`, `Contracts/`, `Components/`). Los nombres `ABDSharedCode` y `ABDSharedAssets` sólo sobreviven en esta tabla, en las actas (`Docs/decisions/`), en los changelogs y en el informe de evaluación de la fusión.

---

## 5. Compatibilidad de estado en el DAW: parámetros retirados y capa de alias

Eliminar un parámetro del APVTS no es un cambio interno: **rompe el *recall* de las canciones ya guardadas**. El DAW escribe el estado con los IDs de la versión con la que se guardó y lo relee con la versión instalada. Esto cubre lo que el ciclo de §3 no alcanza.

### 5.1. Reglas

1. **Un ID retirado no se reutiliza jamás con otro significado.** Reciclar `filter.cutoff` para `filter.drive` convierte cada proyecto antiguo en otro sonido sin ningún error visible.
2. **Todo ID retirado deja una entrada de alias** (`oldId → newId`, o `oldId → valor por defecto`) en una tabla versionada del proyecto.
3. **`setStateInformation` migra antes de aplicar.** Se lee `schemaVersion` del XML; si es anterior, se aplica la tabla de alias y se escriben los IDs nuevos antes de `state.replaceState()`. Si es más nuevo que el plugin, se ignoran las claves desconocidas y se registra un aviso, sin fallar.
4. **La tabla de alias es código, no documentación.** Vive junto al registro de parámetros (`ParameterAliases.gen.h` o equivalente) y tiene su propio test; una tabla en un `.md` no se ejecuta.

```cpp
// Orden correcto en setStateInformation()
auto xml = juce::parseXML(static_cast<const char*>(data), sizeInBytes);
if (xml == nullptr) return;                          // estado corrupto: mantener el actual
const int version = xml->getIntAttribute("schemaVersion", 1);
if (version < kCurrentSchemaVersion)
    migrateStateXml(*xml, version);                  // aplica alias y defaults
state.replaceState(juce::ValueTree::fromXml(*xml));  // ya con IDs actuales
```

### 5.2. Verificación obligatoria

- **Corpus de estados reales:** `tests/state/v<schemaVersion>/*.xml`, con al menos un estado por versión publicada. El test carga cada uno y compara los valores esperados de los parámetros que sobrevivieron.
- **Test de parámetro retirado:** un estado con un ID eliminado carga sin excepción, con el valor por defecto declarado y con una entrada de log estructurada.
- **Test de estado más nuevo:** un XML con `schemaVersion` superior no debe corromper el estado actual.
- **Gate de PR:** retirar un parámetro sin entrada de alias rompe el test del corpus; es el único mecanismo que impide que el olvido llegue al usuario.

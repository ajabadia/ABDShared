# `pluginval` a strictness 10 y convenciones de merge del CI

> **Alcance y estado (2026-11-08).** Documento normativo de la suite: fija el criterio de validación de plugins con `pluginval` y las convenciones con las que un cambio de CI entra en `master`. El criterio técnico detallado vive en [`CALIDAD_Y_ESTANDARES_VST3.md`](CALIDAD_Y_ESTANDARES_VST3.md) §10.1 (**criterio 16** de la matriz comparativa); aquí se registra el criterio vigente, cómo lo aplica el workflow y el procedimiento de merge, para que ambos no se separen.

Los workflows no viven en este repositorio: el estándar es transversal, la ejecución es por proyecto (`ABDAxionikVS/.github/workflows/pluginval.yml`).

---

## 1. Criterio vigente

Un VST3 de la suite **no se considera validado** si no pasa `pluginval` en el nivel máximo.

```powershell
pluginval.exe --strictness-level 10 --skip-gui-tests --timeout-ms 120000 --output-dir reports --validate "<ruta>.vst3"
```

| Parámetro | Por qué está ahí |
| :--- | :--- |
| `--strictness-level 10` | Conjunto completo de pruebas del SDK de Steinberg (estado, hilos, automatización, guardado/restauración, estrés). Por debajo de 10 quedan fuera pruebas que sí detectan defectos reales de tiempo real, así que no acredita el criterio. |
| `--skip-gui-tests` | Los tests de editor exigen sesión gráfica interactiva y son la causa habitual de falsos negativos en CI. **Consecuencia asumida:** el editor no se valida automáticamente; se prueba a mano. |
| `--timeout-ms 120000` | El límite por prueba (30 s) se queda corto: a strictness 10, `Parameter thread safety` recorre los 367 programas y cada carga de preset resincroniza los 445 parámetros. |
| `--output-dir reports` | Deja el informe `.txt` en `reports/`; es la prueba de que la validación se ejecutó. |

**Nivel 5 — histórico.** Se aceptó hasta el 2026-11-07. El workflow nació en strictness 5 (`d8a32ba`) y subió a 10 (`2d018df`). No es criterio de aceptación: citarlo como «validado» es un error de estado, no una variante admitida.

**Cuándo se ejecuta.** En cada push a `master`, en cada pull request y a mano (`workflow_dispatch`).

**Antecedente en verde.** El run `42424775480` de GitHub Actions sobre `ABDAxionikVS` terminó en `SUCCESS`, según recoge `CALIDAD_Y_ESTANDARES_VST3.md` §10; su fecha no consta en esa fuente y por eso no se fija aquí.

---

## 2. Cómo lo aplica el workflow

`ABDAxionikVS/.github/workflows/pluginval.yml`, job `pluginval` (`windows-latest`, `timeout-minutes: 60`):

| Paso | Qué garantiza |
| :--- | :--- |
| Clonar `ABDShared` y JUCE `8.0.12` en `RUNNER_TEMP` | Ni `ABDShared/Code` ni JUCE están vendorizados: CMake los busca fuera del repo (`ABDSHARED_CODE_DIR`, `JUCE_PATH`) y se clonan fuera del árbol para no ensuciarlo. |
| Instalar WebView2 `1.0.3485.44` por NuGet | JUCE enlaza WebView2 estáticamente (`NEEDS_WEBVIEW2` + `*_WITH_STATIC_LINKING`) y el runner no trae el SDK. |
| `cmake -B build -DCMAKE_BUILD_TYPE=Release` + target `ABDAxionikVS_VST3` | El artefacto validado es exactamente el que se compila en el runner, no una copia local. |
| Descargar el release de `pluginval` y validar con los argumentos de §1 | CLI 1.0.4: `--validate` + ruta, sin subcomando `validate` ni `--junit-xml`. |
| `Start-Process -Wait -PassThru` y comprobar `ExitCode` | `pluginval.exe` es un ejecutable de subsistema GUI: con `&` PowerShell vuelve antes y `$LASTEXITCODE` queda vacío (`$null -ne 0` es cierto), así que se espera y se lee el código. |
| Compuerta sobre el informe | El exit code no basta: `pluginval` puede terminar en `0` sin haber validado nada. Si no hay `.txt` en `reports/` o están todos vacíos, el job falla. |
| Subir `reports/` como artefacto (`if: always()`) | El informe queda adjunto también cuando el job falla, que es cuando hace falta. |

---

## 3. Convenciones de merge del CI

Registradas a partir de cómo está construido el historial de ambos repositorios, no de una preferencia teórica. Son las que hay que seguir en el próximo cambio de CI.

### 3.1 Historial lineal: un commit por cambio

Sin merge commits (verificado: `git log --merges` vacío en `ABDAxionikVS` y en `ABDShared` al 2026-11-08). Un pull request entra como **un solo commit**; preferentemente por `rebase` o `squash`, nunca con merge commit ni con la rama de trabajo visible en `master`.

### 3.2 Mensaje: Conventional Commits con scope de área

- Forma: `tipo(scope): asunto en minúscula` — `ci(pluginval)`, `ci(bridge)`, `docs(qa)`, `fix(gestos)`, `feat(ui)`, `test(ui)`.
- El cuerpo explica **el porqué** y las alternativas descartadas, no repite el diff; los commits de agente cierran con la atribución al pie.
- Los tipos usados en la práctica son `feat`, `fix`, `docs`, `ci`, `test`, `refactor`, `chore`.

### 3.3 Un cambio de CI = un commit `ci(...)`

Las iteraciones propias de un cambio de CI no entran sueltas: se integran en `master` ya squasheadas. Ejemplo real: los cuatro commits del workflow de `pluginval` (`d8a32ba` strictness 5, `c7fefc9` SDK WebView2, `338de0d` espera del exit code, `2d018df` strictness 10) quedaron como un único `6dd1ca6 ci(pluginval): valida el VST3 en CI a strictness 10`.

**La fidelidad del squash se comprueba, no se supone:** el árbol del commit resultante debe ser idéntico al último commit de la rama.

```bash
git diff --stat <ultimo-commit-de-la-rama> <commit-squasheado>   # vacío = squash fiel
```

### 3.4 Rama de respaldo antes de reescribir

Cuando el cambio exige reescribir historial (squash de varios commits, split de uno, cambio de mensajes), se crea antes una rama de respaldo `backup/pre-squash-<tema>-<fecha>` (por ejemplo `backup/pre-squash-pluginval-2026-11-08`) y se publica en `origin`.

Se borra **solo** cuando las tres comprobaciones salen bien:

```bash
# 1. El CI quedó intacto: los workflows son idénticos entre respaldo y master
git diff --stat backup/pre-squash-<tema>-<fecha> master -- .github    # vacío

# 2. Lo único distinto es trabajo posterior a la reescritura
git diff --name-only backup/pre-squash-<tema>-<fecha> master

# 3. El contenido del respaldo ya está en origin/master
git diff --stat <tip-del-respaldo> origin/master                      # vacío
```

Si alguna falla, la rama se queda hasta resolverlo. El borrado de la copia remota (`git push origin --delete …`) es una operación de publicación y se pide explícitamente.

### 3.5 Reparto por tema cuando un commit mezcla asuntos

Un commit que mezcla temas se parte por tema, no por ficheros ni por líneas. Ejemplo real en `ABDShared`: `41e578e` mezclaba el criterio de `pluginval` con la corrección de referencias relativas y se separó en `2976afa docs(specs): …` (6 ficheros) y `f214560 docs(pluginval): …` (1 fichero).

El reparto se hace sin tocar el árbol de trabajo y se verifica con dos igualdades:

```bash
git diff --stat <commit-original> <nuevo-tip>    # vacío: el historial nuevo suma lo mismo
git diff --stat <commit-antiguo> <replay>        # vacío: los commits reaplicados no cambian
```

### 3.6 Nada se publica sin autorización

Reescribir historial, hacer `push`, borrar ramas remotas o forzar `origin` son operaciones externas: se hacen cuando se piden, y el resultado declarado es el que se ha comprobado (`git rev-parse`, `git diff`, `git status`), no el que se esperaba.

### 3.7 El CI no debe duplicar trabajo

Los workflows se disparan en `push` a `master` y en `pull_request`, no en cada rama (`bbe4295 ci: limita el push a master para no duplicar checks en PRs`). Donde hay riesgo de solapamiento se usa `concurrency` por referencia, como en `ABDShared/.github/workflows/bridge-guard.yml`.

---

## 4. Dónde vive cada cosa

| Repositorio | Ruta | Propósito |
| :--- | :--- | :--- |
| `ABDShared` | `Docs/architecture/CALIDAD_Y_ESTANDARES_VST3.md` §10.1 | Criterio técnico vigente (criterio 16) y justificación de cada parámetro. |
| `ABDShared` | `Docs/architecture/PLUGINVAL_Y_CONVENCIONES_CI.md` | Este documento: criterio registrado y convenciones de merge. |
| `ABDShared` | `.github/workflows/bridge-guard.yml`, `.github/workflows/publish-packages.yml` | CI de la librería compartida. |
| `ABDAxionikVS` | `.github/workflows/pluginval.yml` | Validación del VST3 con `pluginval`. |
| `ABDAxionikVS` | `.github/workflows/ci.yml` | `tsc` + `vitest` + guard del puente. |

---

## 5. Registro verificado

| Fecha | Hecho | Evidencia |
| :--- | :--- | :--- |
| 2026-11-07 | El criterio sube de strictness 5 a 10 con `--skip-gui-tests` y `--timeout-ms 120000`. | `2d018df` en `ABDAxionikVS`. |
| 2026-11-08 | Los 4 commits del workflow se integran como uno solo, con árbol idéntico. | `6dd1ca6`; `git diff 2d018df 6dd1ca6` vacío. |
| 2026-11-08 | La rama de respaldo `backup/pre-squash-pluginval-2026-11-08` se borra tras comprobar `.github` intacto y contenido ya presente en `origin/master`. | `git diff d46238c master -- .github` vacío. |
| 2026-11-08 | El commit `41e578e` de `ABDShared` se parte en bloque de specs (`2976afa`) y criterio `pluginval` (`f214560`) con árbol final idéntico. | `git diff 41e578e f214560 -- Docs/` vacío. |

---

## 6. Mantenimiento

- Si cambia el criterio, se cambia **en el mismo commit** `ci(pluginval)`: workflow, §10.1 de `CALIDAD_Y_ESTANDARES_VST3.md`, este documento y la tabla de fases y checklists de [`GUIA_CREACION_SINTETIZADORES.md`](GUIA_CREACION_SINTETIZADORES.md). Un criterio escrito en cuatro sitios y cambiado en dos es justo el defecto que este documento evita.
- Un cambio de nivel **no** se aplica retroactivamente al registro de §5: se añade una fila nueva, porque el nivel anterior sigue siendo historia verificable.

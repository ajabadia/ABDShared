# Behringer Pro-800 — Referencia del formato SysEx

> Documento de ingeniería inversa para un futuro proyecto de emulación del Pro-800.
> Las afirmaciones marcadas **✅ están verificadas empíricamente** contra dumps reales de fábrica y
> **cruzadas** entre fuentes independientes: el **"Preset Structure Document" oficial de
> Behringer** (extraído por `steinachim/pro800_manager_plugin`), la probe del hardware de
> **samstaton** (`pro800syx.md`), las **notas extendidas de Defros** contra firmware **1.4.6**
> (`defros/pro800syx-defros.md` + `defros/firmware-1.4.6-defros.md`) y la herramienta **llamamusic**.
> La tabla de CC se cruzó adicionalmente con la base **pencilresearch/midi** (`Pro 800.csv`).
> Lo que **no** ha podido verificarse localmente (no hay hardware ni dump) se indica expresamente
> (p. ej. el §7 de ajustes globales: sondeo de Defros).

---

## 1. Fuentes

| Fuente | Descripción |
|---|---|
| **Behringer "Preset Structure Document"** (oficial, PDF) | `https://cdn.mediavalet.com/aunsw/musictribe/q3-BVIpZck-zi_hAUX2V2Q/McqR_H7pVkW5V21CKYq9Pg/Original/Preset-Structure-Document_BE_0718-ABF_PRO800.pdf` |
| **steinachim/pro800_manager_plugin** (GitHub) | Extracción completa del doc Behringer en `docs/Pro800SysExMessages.md` y `docs/Pro800CCMessages.md` |
| **samstaton/pro800** (GitHub) | Proceso inverso **probando el hardware**: `pro800syx.md` + viewer `pro800.html` + `tuning.csv` + 4 patches de temperamento |
| **Defros (Eindhoven)** [fw 1.4.6, Abr 2026] | `defros/pro800syx-defros.md`: mapa detallado, decode del **System Settings dump**, tabla CC completa 0–123, ejemplos de afinación; `defros/firmware-1.4.6-defros.md`: bugs/obs. del firmware |
| **pencilresearch/midi** (GitHub) | `Pro 800.csv`: base de datos de CC (rango "fine"/LSB 80–116), cross-check de la tabla CC |
| **llamamusic PRO-800 Reader** | `https://llamamusic.com/behringer/` (código en `DOCS\LECTOR\INDEX.html`); paramapping de nombres del parche |
| Dumps locales | `PRO-800_Presets_v1-4-4.syx` (firmware v1.4.4) y `Behringer_Pro-800_Factory_Presets.syx` (firmware antiguo) en `D:\desarrollos\ABDPro008\DOCS\` |
| Electra One forum + ELX-OMA | Address de parche en SysEx y comentarios de parsing (`forum.electra.one/t/behringer-pro-800/2378`) |

---

## 2. Estructura general del mensaje

```
F0 00 20 32 00 01 24 00 | ZZ | (params...) | datos | F7
│  └────┐      ────────┘   └───┘
 F0     Brand ID: 00 20 32 = Behringer
        Product ID: 00 01 24 = Pro-800
        CPU ID: 00
        ZZ: tipo de mensaje
```

| Posición | Valor | Nota |
|---|---|---|
| 0 | `F0` | Inicio de SysEx |
| 1–3 | `00 20 32` | Brand ID (Behringer) |
| 4–6 | `00 01 24` | Product ID (Pro-800) |
| 7 | `00` | CPU ID |
| 8 | `ZZ` | Tipo de mensaje (tabla abajo) |
| 9…n-2 | params + datos | Params de comando (≤2) y/o payload |
| n-1 | `F7` | Fin de SysEx |

**Reglas clave:**
- No hay checksum ni byte de canal.
- Los datos de parche empiezan en la posición **11** (`F0` + 7 de cabecera + `ZZ` + 2 bytes de parche).
- El header completo es constante: `F0 00 20 32 00 01 24 00`.
- Un **slot vacío** responde a una petición con un `F0 F7` **desnudo** (sin cabecera ni tipo).

### 2.1 Tipos de mensaje (documentados por steinachim con respuesta real del hardware)

| Tipo | Params | Significado |
|---|---|---|
| `0x01` | `00`=OK / `01`=FAIL / `01 00 01`=addr desconocida | Mensaje de estado genérico |
| `0x02`/`0x03`/`0x04`/`0x0E` | — | Desconocidos | 
| `0x06` | `00` | Petición de nombre de dispositivo → responde `0x07 50 52 4F 2D 38 30 30 00` ("PRO-800") |
| `0x07` | nombre… | Respuesta nombre de dispositivo |
| `0x08` | `00` | Petición de versión de firmware → responde `09 00 xx yy zz` |
| `0x09` | `echo v1 v2 v3` | Versión = `v1.v2.v3` (los bytes reales están en posiciones 0x0A, 0x0B, 0x0C). Ej. `09 00 01 04 06` = **1.4.6** |
| `0x0A` / `0x0B` | — | **Actualización de firmware** (Defros: `0A ...`, `0B ...`) |
| `0x38` | `00 N 00` | **Tuning**: el hardware emite correcciones al afinar (Defros: `38 00 11 00`, `38 00 12 00`, `38 00 15 00`…) |
| `0x77` | `LSB MSB` | **Petición de dump de parche**. `7E 03` = Settings; slot vacío → respuesta `F0 F7` |
| `0x78` | `LSB MSB datos…` | **Respuesta/escritura de parche** (los datos pueden estar vacíos = "no inicializado") |
| `0x7D` | — | Factory Reset (¡sin confirmación!) |
| `0x32`/`0x35`…`0x72`‑`0x73` | varios | Menús/display/debug (ver doc original) |

El `0x77` para un parche concreto es: `F0 00 20 32 00 01 24 00 77 <LSB> <MSB> F7`.
El **volcado masivo** (dump all) **no existe** por MIDI: se dispara desde el panel (`SETTINGS` → `3` → `3`).

---

## 3. Numeración de programas y slots

- **4 bancos × 100 programas = 400 slots**, slot = `banco*100 + programa` (0–399).
- En los **mensajes SysEx** (`0x77`/`0x78`) los dos bytes de parche son de 7 bits:
  `LSB = slot % 128`, `MSB = floor(slot / 128)`.
- En los **mensajes de Settings** (ver §7) el nº de parche son **2 bytes de 8 bits** (LSB primero), no 7-bit.
- Direcciones de banco usadas en ABDBankManager: `A001`…`D100` (letra + prog 1-based).

---

## 4. Overflow bytes — empaquetado 7→8 (Korg-style)

Los datos del parche son **bytes de 8 bits** y MIDI solo transporta 7. Behringer intercala un
**byte "overflower" cada 8 posiciones** (siempre en múltiplos de 8) que guarda el **bit 7** de
los siguientes bytes:

```
byteValue = payload[pos]
overflowPos  = (pos / 8) * 8              // múltiplo de 8 anterior
overflowBit  = (pos % 8) - 1              // bit dentro del overflower
bit7 = (payload[overflowPos] >> overflowBit) & 1
valor = byteValue | (bit7 << 7)
```

- El overflower puede aparecer **en medio** de un valor multibyte.
- Longitud empaquetada de un registro v111 completo = 198 bytes de payload → **173 bytes decodificados**.

```javascript
// payload = datos MIDI empaquetados (7-bit). Devuelve Uint8Array de 8-bit sin overflow bytes.
function unpack7to8(packed) {
  const out = []; let src = 0;
  while (src < packed.length) {
    const collector = packed[src++];
    for (let i = 0; i < 7 && src < packed.length; i++) {
      out.push((packed[src++] & 0x7F) | (((collector >> i) & 1) << 7));
    }
  }
  return new Uint8Array(out);
}
```

### 4.1 Dos numeraciones de offsets (IMPORTANTE)

- **Posición en el mensaje (p)**: índice dentro del payload contando los overflow bytes
  (la numeración del doc de Behringer; `p=0` es el primer byte de payload, que es un overflower).
- **Offset decodificado (d)**: array plano de 8-bit **sin** overflow bytes (lo que devuelve
  `unpack7to8`; la numeración de samstaton y de ABDBankManager).

Conversión: `d = p - floor(p/8) - 1`  ⟷  p. Ej.: el nombre está en p=172 ⟺ d=150 (0x96).

---

## 5. MAPA DE PARÁMETROS del parche decodificado

> Fuente primaria: doc oficial de Behringer (vía steinachim), **validado** decodificando los
> 100 presets del dump v1.4.4 con la numeración `d` (decodificada, plana).
> `d` = offset decodificado. **Valores continuos = 16-bit little-endian** (`LSB` en `d`, `MSB` en `d+1`),
> rango interno 0–65535 (la UI muestra 0–999).

### 5.1 Cabecera del blob

| d | n° bytes | Descripción | Notas |
|---|---|---|---|
| 0–3 | 4 | **Storage Code** | Constante `A5 16 61 00` (LE: 0x16A5, 0x0061) en todos los dumps |
| 4 | 1 | **Program version** | `0x6D`=109, `0x6E`=110, `0x6F`=111 (ver §6) |

### 5.2 Continuos (pares de 16 bits)

| d (decod) | d+1 | Parámetro | Unidad/escala |
|---|---|---|---|
| 5 | 6 | **Osc A Frequency** | 0–65535 | 
| 7 | 8 | **Osc A Level** | |
| 9 | 10 | **Osc A Pulse Width** | |
| 11 | 12 | **Osc B Frequency** | |
| 13 | 14 | **Osc B Level** | |
| 15 | 16 | **Osc B Pulse Width** | |
| 17 | 18 | **Osc B Fine Frequency** | |
| 19 | 20 | **Filter Cutoff** | |
| 21 | 22 | **Filter Resonance** | |
| 23 | 24 | **Filter Envelope Amount** | |
| 25 | 26 | **Filter Release** | |
| 27 | 28 | **Filter Sustain** | |
| 29 | 30 | **Filter Decay** | |
| 31 | 32 | **Filter Attack** | |
| 33 | 34 | **Amp Release** | |
| 35 | 36 | **Amp Sustain** | |
| 37 | 38 | **Amp Decay** | |
| 39 | 40 | **Amp Attack** | |
| 41 | 42 | **PolyMod Source Filter Env** | |
| 43 | 44 | **PolyMod Source Osc B** | |
| 45 | 46 | **LFO Frequency** | |
| 47 | 48 | **LFO Amount** | |
| 49 | 50 | **Glide Amount** | |
| 51 | 52 | **Amp Velocity** | |
| 53 | 54 | **Filter Velocity** | |
| 76 | 77 | **Modulation Delay** | |
| 78 | 79 | **Vibrato Speed** | |
| 80 | 81 | **Vibrato Amount** | |
| 82 | 83 | **Unison Detune** | |
| 142 | 143 | **Noise Amount** | |
| 144 | 145 | **Amp Aftertouch Amount** | |
| 146 | 147 | **Filter Aftertouch Amount** | |
| 166 | 167 | **LFO Aftertouch Amount** | solo versión ≥ 110 |
| 171 | 172 | **Pitchbend Range** | `0x0800` = 1 semitono; default `0x6000` = 12 (versión ≥ 111) |

### 5.3 Stepped / toggles (1 byte)

| d | Parámetro | Valores |
|---|---|---|
| 55 | **Osc A Shape — Saw** | 0/1 (off/on) |
| 56 | **Osc A Shape — Tri** | 0/1 |
| 57 | **Osc A Shape — Rect** | 0/1 |
| 58 | **Osc B Shape — Saw** | 0/1 |
| 59 | **Osc B Shape — Tri** | 0/1 |
| 60 | **Osc B Shape — Rect** | 0/1 |
| 61 | **Osc A Sync** | 0/1 |
| 62 | **PolyMod Dest Freq A** | 0/1 |
| 63 | **PolyMod Dest Filter** | 0/1 |
| 64 | **LFO Shape** | 0=Pulse, 1=Tri, 2=Rand, 3=Sin, 4=Noise, 5=Saw |
| 65 | **LFO Speed** | 0=Slow, 1=Fast |
| 66 | **LFO Destination** | **Bitmask**: Freq(1) · Filter(2) · PW(4) · Osc A(8) · Osc B(16) · ??(32) · VCA(64) |
| 67 | **Filter Keyboard Tracking** | 0=Off, 1=Half, 2=Full |
| 68 | **Filter Envelope Shape** | 0=Lin, 1=Exp |
| 69 | **Filter Envelope Speed** | 0=Fast, 1=Slow |
| 70 | **Amp Envelope Shape** | 0=Lin, 1=Exp |
| 71 | **Poly-Mod Unison Track / Unison** | 0=Off, 1=On |
| 72 | **Pitchbend Target** | 0=Off, 1=VCO, 2=VCF, 3=Vol |
| 73 | **Mod Wheel Amount** | 0=Min, 1=Low, 2=High, 3=Full |
| 74 | **Osc A Freq Pot Mode** | 0=Free, 1=Semi, 2=Oct, 3=FiHD |
| 75 | **Osc B Freq Pot Mode** | idem |
| 84 | **Mod Wheel Target** | 0=LFO, 1=Vib |
| 85 | **reserved** | |
| 148 | **Amp Envelope Speed** | 0=Fast, 1=Slow |
| 149 | **ARP Mode** | |
| 168 | **Voice Spread Enable** | 0/1 (versión ≥ 111) |
| 169 | **Key Tracking Reference Note** | `0x03`=C4, `0x02`=C3… (versión ≥ 111) |
| 170 | **Glide Mode** | 0=Time, 1=Speed (versión ≥ 111) |

### 5.4 Notas de acorde / patrón de unisono — 8 bytes

| d | Parámetro | Notas |
|---|---|---|
| 86…93 | **Chord Note 1…8** | Intervalo en **semitonos sobre la raíz**; `0x00`=raíz, `0xFF`=`255` = sin nota (mono/unisono). (Defros + probe samstaton "unison voice pattern") |

Son las notas de la función **Chord Memory**: 8 voces programables como intervalos sobre la
nota raíz. Comparten offsets con el patrón de unisono del parche.

### 5.5 Tune Per Note (escalas de afinación) — 48 bytes

| d | n° bytes | Parámetro |
|---|---|---|
| 94–97 | 4 | Tune Per Note — C |
| 98–101 | 4 | Tune Per Note — C# |
| 102–105 | 4 | Tune Per Note — D |
| 106–109 | 4 | Tune Per Note — D# |
| 110–113 | 4 | Tune Per Note — E |
| 114–117 | 4 | Tune Per Note — F |
| 118–121 | 4 | Tune Per Note — F# |
| 122–125 | 4 | Tune Per Note — G |
| 126–129 | 4 | Tune Per Note — G# |
| 130–133 | 4 | Tune Per Note — A |
| 134–137 | 4 | Tune Per Note — A# |
| 138–141 | 4 | Tune Per Note — B |

- **4 bytes por nota**, LSB primero (float LE). El **bit más significativo del 4º byte es el signo**
  (afinación hacia arriba/abajo).
- 12TET = todo `00 00 00 00`. La escala **no es lineal** en cents (posiblemente logarítmica);
  `tuning.csv` (samstaton) da la tabla completa de **cents → valor float32 LE** (p. ej.
  `-24 cents = AE FF 7C BE`, `-17 = 98 51 35 BE`, `0 = 00 00 00 00`).
- **✅ Validado empíricamente**: el parche `pro800-101-Meantone.syx` (samstaton) coincide
  **byte a byte** en `d94–141` con el ejemplo quarter-comma meantone de Defros:
  `00 00 00 00 AE FF 7C BE 62 D6 9D BD 2B 0C D7 3D 1D 3D 07 BE E7 5A 03 3D …`
- Patrones incluidos en el repo samstaton: `pro800-100-12TET`, `-101-Meantone`, `-102-Pythagorean`,
  `-103-Werckmeister-III` (los 3 últimos con los mismos bytes no-lineales de Defros).

### 5.6 Nombre del parche — 16 bytes

| d | n° bytes | Descripción |
|---|---|---|
| 150–165 | 16 | **Patch name** (offset decodificado `0x96`) |

- Versión **0x6D (109)**: el nombre es el **último campo** del registro (longitud variable);
  relleno tras el null a `0x00` o `0x7F`.
- Versión **0x6E (110)**: el LFO Aftertouch (`d166–167`) se coloca **inmediatamente después** del
  nombre; si el LFO AT vale 0, se ha observado que el delimitador `0x00` puede omitirse (nombre
  de longitud variable también). *Confirmado*: en el dump factory, slot 0 (`0x6E`) termina con
  `d166–167 = 00 00` justo tras el nombre.
- Versión **≥ 0x6F (111)**: campo **fijo de 16 bytes**; unused bytes a `0x00`, a veces `0x7F` **o
  `0x80`** (los 11 presets factory copiados tal cual rellenan con `80 80 80 00 80 …`; el resto a `0x00`).
- ⚠️ Nunca confiar en que el relleno del nombre sea `0x00`: filtrar por **terminador `0x00` + no
  imprimibles**, no por "hasta 16" (en `0x6D` el registro termina en el primer `0x00`).
- Longitudes reales máx. observadas: **15 chars** ("Classical Brass"). `patchNameMaxLength = 16`.
- En crudo MIDI: posiciones del mensaje 172–189 (con overflow bytes en 176 y 184 que **no** participan en el nombre).

### 5.7 Ejemplos validados (dump v1.4.4, decodificados 173 bytes)

**"Organ I" (slot 0):** `version=0x6F`, storage `16A5 0061`; OscA square ON, OscB square ON,
OscA Sync ON, LFO Dest=4 (PW), KeyTrk=2 (full), cut 0x9566, res 0x8480, AmpSus=0xFFFF,
PB Range=0x6000 (12 semitonos). Cola `d[166..172] = 00 00 00 03 00 00 60` → LFO AT 0x0000,
VoiceSpread=0, KeyRef=3, GlideMode=0, PitchRange 0x6000. ✓

**"Metallic I" (slot 4):** OscA level 0xFFFF, Tri A+B+Rect B ON, Sync OFF, PB Target=1 (VCO),
MW Target=1 (Vib), ARP=6, VCA env Exp(1). ✓

**"Alien" (slot 99):** Res=0xFFFF, Unison=1 ON, KeyTrk=off, Vol B=0. ✓

**"Meantone" (parche `pro800-101-Meantone.syx`):** d94–141 = bytes de cuarto-coma mean-tone
**idénticos** a los publicados por Defros (ver §5.5). Confirma tabla de afinación + offsets. ✓

Todo el mapa anterior produce valores plausibles en los 100 presets + el parche de temperamento.

---

## 6. Versión del parche (109/110/111) — DIFERENTE SEGÚN FIRMWARE ✅

El byte `d[4]` es la **versión del formato del parche**, y **depende de la versión de firmware**.
**Verificado empíricamente en los dumps** (mismo preset = mismo blob salvo este byte y la cola):

| d[4] | Decimal | Firmware | Campos adicionales | Longitud decodificada |
|---|---|---|---|---|
| `0x6D` | 109 | revs antiguas (presets de fábrica) | El nombre es el último campo → registro **variable**; puede arrastrar relleno/junk hasta **183** | 155–166 (+ 183 con junk) |
| `0x6E` | 110 | **hasta v1.2.7** | + LFO Aftertouch Amount (2B) **inmediatamente después del nombre** | **168 fijo** (confirmado en dump factory) |
| `0x6F` | 111 | **v1.3.6 en adelante** (v1.4.4, v1.4.6) | + Voice Spread, Key Track Ref, Glide Mode, Pitchbend Range (d168–172) | **173 fijo** |

- **Dump v1.4.4** (fw 1.4.4): 100/100 `0x6F`, 173 fijo, mensaje de 210 B.
- **Dump factory** (fw antiguo): mezcla de **98× `0x6D` + 3× `0x6E`**, longitudes variables
  (155–183; por eso llamamusic los llama "unreadable by most utilities").
- **11 presets factory `0x6D`** (Metallic I, Honky Tonk, Nasal Bass, Slow Brass, Dog's Bark, Cat's
  Meow, Tack Synth, Low Plucky, Space Race, Super Perc, Full Organ) traen cola junk tras el nombre
  (`80 80 80 00 80` + `80 80` + ceros → 183 B). Un parser debe **parar en el terminador del nombre**
  y no leer d166+ en registros `0x6D`.
- **Cross-check duro**: "Metallic I" (slot 4) es **byte-idéntico en `d0–d160`** entre el dump
  factory (`0x6D`/183) y v1.4.4 (`0x6F`/173); solo difieren `d[4]` y la cola. Misma preset ha sido
  copiada a través de firmwares manteniendo todos los offsets d0–d165.
- Los patches de temperamento de samstaton son `0x6E` (dumpeados de un equipo ≤1.2.7): validan los
  mismos offsets d86–d141 (chord + afinación).
- Para un emulador: **detectar por `d[4]`** y leer los campos según la tabla; truncar/padrear a 173.

---

## 7. Mensajes de Settings (`77 7E 03` → respuesta `78 7E 03 datos`)

La respuesta trae el storage code `A5 16 61 00` + `0x6F` (misma cadena que el parche), el nº de
parche actual y **todos** los ajustes globales. Offsets decodificados `d` (plano, sin overflow).
⚠️ **sondeo de Defros contra fw 1.4.6 — no verificable localmente** (ningún dump en `DOCS`
contiene un dump de sistema). Los offsets `d` se han **re-derivado aquí** desempaquetando el
byte-stream crudo que publicó Defros (colector cada 8 bytes = `01 | 25 16 61 00 6F 7C 00 | 04 | 02
02 7F 02 00 00 74 | 00 | 01 00 10 07 03 03 01 | 00 | 01 00 00 0C 02 00 01 | 00 | 02 01 00 00 01 01
32 | 00 | 00 00 00 01 01 | F7`):

| d | Parámetro | Valores |
|---|---|---|
| 0–3 | storage code | `A5 16 61 00` (LE: 0x16A5, 0x0061) — igual que en el parche |
| 4 | version | `0x6F` (fw 1.4.6); `0x6E` para firmwares ≤ 1.2.7 |
| 5–6 | **Current Patch + Bank** | 2×8-bit LSB→MSB (p. ej. `7C 00` = 124 → B-24; `02 00` = A-02) |
| 7 | **Preset Mode** | 0=MANUAL, 1=LOADED, 2=EDITED |
| 8 | **MIDI RX Channel** | 0=ALL, 1=dip switches, 2–17=ch1–16 |
| 9 | **Kill Voices** | bitmask 8 voces; la voz 7 vive en el bit MSB (byte del colector) |
| 10 | **MIDI TX Channel** | 0=THRU, 1=dip, 2–17=ch1–16 |
| 11 | **Sync Source** | 0=Internal, 1=MIDI, 2=USB, 3=External |
| 12 | (sin documentar, `00`) | |
| 13–14 | **Sync Clock BPM** | seg. Defros: `LSB + MSB×128 = BPM×10`; `50.0`→`74 03`, `400.0`→`20 1F` |
| 15 | (sin documentar, `00`) | |
| 16 | **Screen Brightness** | 1–16 |
| 17 | **Screen Param Time** | 0–100 (7) |
| 18 | **MIDI CC Mode** | 0=OFF, 1=TX, 2=RX, 3=TxRx |
| 19 | **MIDI PC Mode** | idem |
| 20 | (sin documentar, `01`) | |
| 21 | **Sync In Forward** | 0=Off, 1=On |
| 22 | (sin documentar, `00`) | |
| 23 | **Ext. Filter Mod Amount** | byte bajo; 0–999 (ancho multibyte sin confirmar) |
| 24 | **PB Range** (legacy) | 0x0C — se movió al área de parche (d171–172) en revs posteriores |
| 25 | **Sync Clock Subdivision (Divider)** | 0=1/4, 1=1/4t, 2=1/8, 3=1/8t, 4=1/16, 5=1/16t, 6=1/32, 7=1/32t |
| 26 | **Voice Priority** | 0=Last, 1=Low, 2=High |
| 27 | **Preset Name Display** | 0=Off, 1=On |
| 28 | **Sync In Polarity** | 0=Rise, 1=Fall, 2=Both |
| 29 | (sin documentar, `01`) | |
| 30 | **AutoTune Precision** | 0=0.5c, 1=1c, 2=1.5c, 3=2c |
| 31 | **Sync In Start/Stop** | 0=Off, 1=On |
| 32 | **Pulse Divider In (PPQN)** | 0=1PPS, 1=1PPQ, 2=Korg, 3=4PPQ, 4=24, 5=48 |
| 33 | **Note Length** | 1–100 |
| 34 | **Swing** | 50–95 |
| 35 | **Aftertouch VCA Polarity** | 0=High, 1=Low |
| 36 | **Aftertouch VCF Polarity** | 0=High, 1=Low |
| 37 | **Transpose** | 2-complement: `00`…`23`=+0…+35, `7D`=−3, `5D`=−35 |
| 38 | **Midi Soft Thru** | 0=Off, 1=On |
| 39 | **Midi Local Enable** | 0=Off, 1=On |

> Nota sobre BPM (ambiguo, **requiere hardware**): la **aritmética** de Defros es
> `LSB + MSB×128 = BPM×10` (p. ej. `50.0` → `74 + 3×128 = 500`; `400.0` → `20 + 1F×128 = 4000`),
> pero sus **capturas crudas** no la reproducen de forma directa: con el bit6 del colector
> aplicado al LSB, la lectura **16-bit LE** (`d13`=LSB, `d14`=MSB, `value=L+MSB×256 = BPM×10`)
> encaja el caso 400.0 exactamente (`44 … 20 00 0F` → `A0 0F` = 0x0FA0 = 4000 = 400.0), mientras
> que el caso 50.0 se capturó con `04 … 74 00 01` (→ `74 01` = 0x0174 = 372, sin ajustar).
> → Dejar marcado como sospechoso hasta validar con el hardware real.

Notas de Defros:
- La numeración de parche del dump de sistema son **2 bytes de 8 bits** (LSB primero), **distinta**
  de la del `0x77`/`0x78` (7-bit, LSB=`slot%128`, MSB=`slot/128`).
- **Pedal Polarity no está en el dump** (o los cambios no se escriben en memoria) = bug (ver §8).
- El Sync Clock BPM con `Sync Source ≠ Internal` muestra 0–999 en lugar de BPM 50–400 (bug).

---

## 8. Tabla MIDI CC 0–123 (sondeo fw 1.4.6, Defros; cruzada con `Pro 800.csv`)

> Los parámetros continuos tienen **dos CC**: un CC "coarse" (MSB, rango 8–42) y su CC
> **fine/LSB** (rango **80–117**, mismos parámetros, mismos valores 0–127). El CSV de
> pencilresearch lista hasta la 116; Defros llega a la 117 (PB Range LSB).

**Continuos (coarse):** CC1 Mod Wheel · CC2 Breath · CC3 Master Tune · CC7 Main Volume ·
CC8 OSC_A_FREQ · CC9 OSC_A_VOL · CC10 OSC_A_PW · CC11 OSC_B_FREQ · CC12 OSC_B_VOL ·
CC13 OSC_B_PW · CC14 OSC_B_FINE · CC15 VCF_FREQ · CC16 VCF_RESO · CC17 VCF_ENV_AMT ·
CC18 VCF_REL · CC19 VCF_SUS · CC20 VCF_DEC · CC21 VCF_ATCK · CC22 VCA_REL · CC23 VCA_SUS ·
CC24 VCA_DEC · CC25 VCA_ATCK · CC26 PMOD_FILT_ENV · CC27 PMOD_OSC_B · CC28 LFO_FREQ ·
CC29 LFO_AMT · CC30 GLIDE · CC31 VCA_VEL · CC32 VCF_VEL · CC33 MOD_DELAY · CC34 VIB_FREQ ·
CC35 VIB_AMT · CC36 UNISON_DETUNE · CC37 NOISE · CC39 VCA_AT · CC40 VCF_AT · CC41 LFO_AT ·
CC42 PB_RANGE (0–31)

**Fine/LSB (80–117):** CC80 OSC_A_FREQ … CC116 LFO_AT con la misma secuencia que el coarse
(81→VOL, 82→PW, 83→OSC_B_FREQ, 84→VOL, 85→PW, 86→FINE, 87→VCF_FREQ, 88→RESO, 89–93→VCF ENV,
94/95→VCA REL/SUS, 100/101→VCA DEC/ATCK, 102–108→PMOD/LFO/GLIDE/VEL, 109–113→MOD_DELAY/VIB…/NOISE,
114–116→VCA/VCF/LFO AT, 117→PB RANGE LSB).

**Switches y stepped (48–79):** los valores son "Off" = `00`, "On" = `40` (0x40):

| CC | Parámetro | Valores |
|---|---|---|
| 48 | OSC A Saw | 00/40 |
| 49 | OSC A Tri | 00/40 |
| 50 | OSC A Sqr | 00/40 |
| 51 | OSC B Saw | 00/40 |
| 52 | OSC B Tri | 00/40 |
| 53 | OSC B Sqr | 00/40 |
| 54 | OSC B Sync | 00/40 |
| 55 | PMOD Dest Freq A | 00/40 |
| 56 | PMOD Dest VCF | 00/40 |
| 57 | LFO Shape | Pulse=`00`, Tri=`16`, Rand=`2C`, Sin=`42`, Noise=`58`, SawUp=`6E` |
| 58 | LFO Speed | 00/40 (Fast/Slow) |
| 59 | LFO Targets | bitmask/set (AB=`00`, A=`21`, B=`42`, VCA=`63`) |
| 60 | VCF Keyboard Trk | Off=`00`, Half=`2B`, Full=`56` |
| 61 | VCF ENV Exp | 00/40 (Lin/Exp) |
| 62 | VCF ENV Speed | 00/40 (Fast/Slow) |
| 63 | VCA ENV Exp | 00/40 |
| 64 | Sustain Pedal | 00/40 |
| 65 | Unison | 00/40 |
| 66 | Bender Target | Off=`00`, VCO=`20`, VCF=`40`, Vol=`60` |
| 67 | Mod Wheel Amount | Min=`00`, Low=`20`, High=`40`, Full=`60` |
| 68 | OscA Freq Pot Mode | Free=`00`, Semi=`20`, Oct=`40`, FiXed=`60` |
| 69 | OscB Freq Pot Mode | idem |
| 70 | Mod Wheel Target | LFO=`00`, Vib=`40` |
| 71 | *— vacío (Vibrato TF en el PC-800)* | |
| 72 | VCA ENV Speed | 00/40 |
| 73 | **Arp Mode** | Off=`00`, Up=`13`, Down=`25`, UpDown=`37`, Up+Down=`4A`, Assign=`5C`, Rnd=`6E` |
| 74 | LFO Dest Freq | 00/40 |
| 75 | LFO Dest Filter | 00/40 |
| 76 | LFO Dest PW | 00/40 |
| 77 | Voice Spread | 00/40 |
| 78 | Key Filter Track Ref | C1=`00`, C2=`20`, C3=`40`, C4=`60` |
| 79 | Glide Mode | Time=`00`, Speed=`40` |

**Sistema/NRPN:** CC6 NRPN Data MSB · CC38 NRPN Data LSB · CC96 NRPN Inc · CC97 NRPN Dec ·
CC98 NRPN Par LSB · CC99 NRPN Par MSB · CC120 All Sounds Off · CC123 All Notes Off.

**Selección de preset:** CC0 = banco (A=0…D=3) + Program Change 0–99.

Conflictos / bugs (firmware 1.4.6, Defros):
- **CC50 doble uso**: el PC-800 (predecesor) usaba CC50 para subdivision del reloj; el Pro-800 lo
  recibe como **LSB de OSC A Freq** y no permite editar subdivision por CC. Bug confirmado.
- **CC49 (0x31) Arp Mode**: el Pro-800 **no envía** el Arp Mode por CC (sí lo recibe). (La nota de
  Defros dice CC49, pero por la tabla el Arp Mode real es CC73.)
- **CC76** acepta 00–1F y se muestra en display pero **no cambia el sonido** (parámetro fantasma).
- Bug histórico: CC de velocidades VCF/VCA a la inversa que el panel (musictribe).

**Otros bugs de firmware relevantes para SysEx / afinación** (Defros, fw 1.4.6):
- **Pedal Polarity no aparece en el dump de sistema** (ni sus cambios se escriben en memoria): el
  valor no viaja en `77 7E 03` y no hay forma de persistirlo/leerlo por SysEx (ver §7).
- **Key-tune (Settings → tecla + Tune): solo la nota C responde**; en C#–B no se oye ni se guarda
  el valor en el preset / dump (el valor `-999..999` solo se fija para C).
- **Manual Tuning Voice-Element-Octave (Retune)**: editable en el menú (8 voces × OscA/OscB/Filter
  × 8 octavas) pero **no se conserva tras apagar** y no se exporta por SysEx.
- **`0x38` durante la afinación**: un *short-press* de Tune emite varias cadenas
  `38 00 11 00 F7`, `38 00 12 00`, `38 00 15 00`, `38 00 16 00`, `38 00 17 00` (significado sin
  documentar).
- Copia/paste de presets con nombre: `[REC][n][n]`/`[REC][n][PRESET]` **no copia el nombre**; solo
  `COPY`/`PASTE` (`[PRESET][5][6]`) lo conserva. Y el texto del display de paste sale corrupto
  (A-2H sobre A-2J) aunque la preset se copia bien.
- Comando del Quickguide para fijar la velocidad del secuenciador durante la reproducción no
  funciona en v1.4.6.

---

## 9. Los 100 presets de fábrica

| # | Slot | Nombre | # | Slot | Nombre |
|---|---|---|---|---|---|
| 0 | 0 | Organ I | 50 | 50 | Distorted Organ |
| 1 | 1 | Classical Brass | 51 | 51 | Digital Brass |
| 2 | 2 | Strings | 52 | 52 | High Strings |
| 3 | 3 | Poly Glide I | 53 | 53 | PWM I |
| 4 | 4 | Metallic I | 54 | 54 | High Plucky |
| 5 | 5 | Triangle Waves | 55 | 55 | Descending Bell |
| 6 | 6 | Power Synth | 56 | 56 | Harpsi-Synth |
| 7 | 7 | Mini Lead | 57 | 57 | Nasal Bass |
| 8 | 8 | Poly Glide II | 58 | 58 | Xylophone |
| 9 | 9 | Video Games | 59 | 59 | Obnoxious Mod |
| 10 | 10 | Organ II | 60 | 60 | Cathedral Organ |
| 11 | 11 | Brass I | 61 | 61 | Slow Brass |
| 12 | 12 | Muted Strings | 62 | 62 | Arco Bass Viol |
| 13 | 13 | Clav I | 63 | 63 | Frog City |
| 14 | 14 | Perc EPiano | 64 | 64 | Dog's Bark |
| 15 | 15 | Flute | 65 | 65 | Cat's Meow |
| 16 | 16 | Harpsichord I | 66 | 66 | Sustained Sync |
| 17 | 17 | Sync I | 67 | 67 | Modor |
| 18 | 18 | Club Organ | 68 | 68 | Tack Synth |
| 19 | 19 | Sleeping Orgs | 69 | 69 | Gonzoid SteelDr |
| 20 | 20 | Organ Flute | 70 | 70 | Organ Perc I |
| 21 | 21 | Brass II | 71 | 71 | B.D.I.'s |
| 22 | 22 | Light Strings | 72 | 72 | R.F.M. |
| 23 | 23 | Clav II | 73 | 73 | Harmonium |
| 24 | 24 | Ice Cream | 74 | 74 | Metallic II |
| 25 | 25 | Muted | 75 | 75 | PolyMod Glide |
| 26 | 26 | Sync II | 76 | 76 | Sync III |
| 27 | 27 | Full Bass | 77 | 77 | Fat Octaves |
| 28 | 28 | Movies | 78 | 78 | Low Plucky |
| 29 | 29 | Space Leeches | 79 | 79 | Space Race |
| 30 | 30 | Chorus Organ | 80 | 80 | Organ Perc II |
| 31 | 31 | Bach Trumpet | 81 | 81 | Detuned |
| 32 | 32 | Low Strings | 82 | 82 | Vocal Harmonica |
| 33 | 33 | Harmonica | 83 | 83 | Square Bubbles |
| 34 | 34 | Wurlie Piano | 84 | 84 | Metallic III |
| 35 | 35 | Dinkity-Dink | 85 | 85 | Josef |
| 36 | 36 | Buddy | 86 | 86 | PWM II |
| 37 | 37 | Cutting Bass | 87 | 87 | Lucky Man |
| 38 | 38 | Echo-Repeat | 88 | 88 | Super Perc |
| 39 | 39 | Screamin' Memes | 89 | 89 | Noise Scream |
| 40 | 40 | Chiffy Organ | 90 | 90 | Full Organ |
| 41 | 41 | Brass III | 91 | 91 | Filter Funk |
| 42 | 42 | Arco Strings | 92 | 92 | Banjo |
| 43 | 43 | Runaway | 93 | 93 | Clav III |
| 44 | 44 | Honky Tonk | 94 | 94 | PWM III |
| 45 | 45 | Whistle | 95 | 95 | Drunken Synth |
| 46 | 46 | Angelic Synth | 96 | 96 | Tears |
| 47 | 47 | Hard Lead Bass | 97 | 97 | Fifths Lead |
| 48 | 48 | Harp | 98 | 98 | Ooops! |
| 49 | 49 | Indigestion | 99 | 99 | Alien |

---

## 10. Verificación empírica de los dumps

| Métrica | v1.4.4 | Factory (fw antiguo) |
|---|---|---|
| Tamaño de archivo | 21.000 bytes | 20.166 bytes |
| Nº de mensajes | 100 | 101 |
| Largo de mensaje | fijo 210 | variable 190–222 |
| Bytes decodificados | fijo **173** (v111) | variable **155–183** (v109/v110; ver §6) |
| Byte de versión | `0x6F` (100/100) | `0x6D`=98 + `0x6E`=3 |
| Slots detectados | 0–99 | 0–99 + **207** (banco 2, prog 7) |
| Nombres correctos | 100/100 | 100/100 (+1 vacío en slot 207) |
| **Cross-check** | misma preset ↔ dump antiguo: "Metallic I" byte-idéntico en `d0–d160` (solo difiere `d[4]` + cola) | → valida que el mapa d0–d172 es el mismo en ambos formatos |

---

## 11. Notas para el emulador

1. **Identificación**: `F0 00 20 32 00 01 24 00` + `0x78` + `F7`. Diferencia con el **DeepMind 12** (`0x0E` en byte 4, formato distinto de 242 bytes).
2. **Parser**: datos desde byte 11, desempaquetar 7→8, usar offsets decodificados `d` de la §5.
3. **Nombre**: `d=150`, parar en `0x00`, máx. 16 chars, filtrar no imprimibles; en `0x6D` el
   registro termina en el primer `0x00` (no leer d166+).
4. **Firmware vs formato**: el byte `d[4]` decide la longitud real del registro (109/110/111; §6).
   Truncar a 173. Nunca asumir una única versión dentro de un dump (el factory mezcla 6D+6E).
5. **Dump masivo**: no existe por MIDI; es key-combo del hardware (`SETTINGS`→`3`→`3`).
6. **Scaling continuo**: valores de 16-bit LE 0–65535 (UI 0–999). El emulador debe mapear a sus escalas reales (Hz, ms…).
7. **Pitchbend Range**: `0x0800` = 1 semitono, `0x6000` = 12 (default).
8. **Bug conocido de firmware**: CC de velocidades VCF/VCA a la inversa que el panel
   (bug documentado en community.musictribe.com); el editor de steinachim lo compensa.

---

## 12. Implementación de referencia en ABDBankManager

- `Source/Contracts/Models/behringer-pro800.ts` — contrato canónico independiente del Pro-800
  (header, `0x77`/`0x78`, slot LSB/MSB, banco 4×100, nombre en 0x96, `patchDataSize=173`).
- `Source/Contracts/Models/behringer-dm12.ts` — solo DeepMind 12, sin spread.
- `WebUI/src/core/sysexParser.js` — desambiguación por `bytes[4..6] = 00 01 24` → pro800.
- `Source/Contracts/Adapters/behringerDm12Adapter.ts` — rama Pro-800.
- Tests: `contractRoundtrip.test.js` y suite (248 tests, 0 fallos, resto de la suite green).

```javascript
const parsed = pro800.parsePatchSysEx(sysexMsg);       // { rawData: Uint8Array(173), slot }
const d = parsed.rawData;
const cutoff = d[19] + d[20] * 256;                    // Filter Cutoff 0–65535
const name   = pro800.extractPatchName(d);             // "Organ I"
```
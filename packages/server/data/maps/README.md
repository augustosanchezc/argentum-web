# Mapas

Estos archivos provienen del proyecto **[ao-libre/ao-server](https://github.com/ao-libre/ao-server)** (AGPL-3.0), fork comunitario del *Argentum Online* original de Pablo Marquez (Maraxus).

Formato binario heredado del cliente VB6 original. La descripción incluida en `Mapa1.map` confirma:

> GS-Zone Argentum Online MOD - Copyright GS-Zone 2012 - info@gs-zone.org - Original by Pablo Marquez

## Origen exacto

- Repositorio: <https://github.com/ao-libre/ao-server>
- Path en origen: `Mundos/Alkon/`
- Licencia: **AGPL-3.0** (compatible con la nuestra)

## Mapas presentes

| Archivo | Tamaño | Contenido |
|---|---|---|
| `Mapa1.map` | 53 651 B | Ciudad de Ullathorpe — capa de gráficos + flag de bloqueo |
| `Mapa1.dat` | 181 B | Metadata: nombre, música, terreno, zona, restricciones |
| `Mapa1.inf` | 12 808 B | NPCs, objetos, exits (warps entre mapas) |

## Formato resumido

Documentado en `packages/server/src/world/ao-map-loader.ts`. Resumen:

- **Header `.map`** (273 bytes): `Version: u16 LE` + `Desc: 255 ASCII` + `CRC: u32 LE` + `MagicWord: u32 LE` + `padding: f64`
- **Body**: por cada tile en orden `(y, x)` con `y` outer, `x` inner, ambos 1..100:
  - `flags: u8` — bit 0 = blocked, 1 = layer2, 2 = layer3, 3 = layer4, 4 = trigger
  - `layer1: u32 LE` (siempre)
  - `layer2..4: u32 LE` si la flag está activa
  - `trigger: u16 LE` si bit 4

El formato corresponde al `LoadMapData` original en VB ([referencia](https://github.com/ao-libre/ao-server/blob/master/Codigo/FileIO.bas#L1586)).

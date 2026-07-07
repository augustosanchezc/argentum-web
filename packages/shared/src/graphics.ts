// Sistema de gráficos del AO original.
// Cada `bodyId` apunta a secuencias de GRH (Graphic Resource Handle) para
// cada dirección de la animación de caminata.
// Los archivos reales son /graficos/{grhId}.png — generados desde los BMP del
// cliente original con `scripts/convert-ao-graphics.mjs`.
// Los valores aquí son aproximaciones basadas en el layout de Personajes.ind
// del AO 20; el script de conversión genera grh-index.json con datos exactos.

export type AnimDirection = "north" | "south" | "east" | "west";

export interface BodyFrames {
  // 3 GRH IDs por dirección (stop, walk1, walk2)
  readonly north: readonly number[];
  readonly south: readonly number[];
  readonly east:  readonly number[];
  readonly west:  readonly number[];
  // Desplazamiento en píxeles para dibujar la cabeza sobre el cuerpo
  readonly headOffsetY: number;
}

export interface HeadFrame {
  readonly grh: number;
}

// Animaciones de cuerpo indexadas por bodyId (Personajes.ind del AO).
// Cada cuerpo usa 12 GRHs consecutivos (4 dirs × 3 frames), en orden:
// south×3, north×3, west×3, east×3 — el mismo orden que Personajes.ind.
export const BODY_ANIMATIONS: Record<number, BodyFrames> = {
  // Body 1: humano masculino (Guerrero / Clérigo)
  1:  { south: [2,3,4],     north: [5,6,7],     west: [8,9,10],     east: [11,12,13],    headOffsetY: -14 },
  // Body 2: humano femenino (Arquero / Asesino)
  2:  { south: [14,15,16],  north: [17,18,19],  west: [20,21,22],   east: [23,24,25],    headOffsetY: -14 },
  // Body 3: humano robed (Mago / Druida)
  3:  { south: [26,27,28],  north: [29,30,31],  west: [32,33,34],   east: [35,36,37],    headOffsetY: -12 },
  // Body 5: Dragón verde (boss)
  5:  { south: [38,39,40],  north: [41,42,43],  west: [44,45,46],   east: [47,48,49],    headOffsetY: 0 },
  // Body 7: Araña pequeña
  7:  { south: [50,51,52],  north: [53,54,55],  west: [56,57,58],   east: [59,60,61],    headOffsetY: 0 },
  // Body 8: Oso pardo
  8:  { south: [62,63,64],  north: [65,66,67],  west: [68,69,70],   east: [71,72,73],    headOffsetY: 0 },
  // Body 10: Lobo
  10: { south: [74,75,76],  north: [77,78,79],  west: [80,81,82],   east: [83,84,85],    headOffsetY: 0 },
  // Body 12: Vampiro
  12: { south: [86,87,88],  north: [89,90,91],  west: [92,93,94],   east: [95,96,97],    headOffsetY: -14 },
  // Body 15: Esqueleto
  15: { south: [98,99,100], north: [101,102,103], west: [104,105,106], east: [107,108,109], headOffsetY: 0 },
  // Body 24: Zombie
  24: { south: [110,111,112], north: [113,114,115], west: [116,117,118], east: [119,120,121], headOffsetY: -10 },
  // Body 25: Trol
  25: { south: [122,123,124], north: [125,126,127], west: [128,129,130], east: [131,132,133], headOffsetY: 0 },
  // Body 33: Goblin
  33: { south: [134,135,136], north: [137,138,139], west: [140,141,142], east: [143,144,145], headOffsetY: -10 },
  // Body 42: Orco
  42: { south: [146,147,148], north: [149,150,151], west: [152,153,154], east: [155,156,157], headOffsetY: 0 },
  // Body 71: Rata gigante
  71: { south: [158,159,160], north: [161,162,163], west: [164,165,166], east: [167,168,169], headOffsetY: 0 },
  // Body 97: Víbora
  97: { south: [170,171,172], north: [173,174,175], west: [176,177,178], east: [179,180,181], headOffsetY: 0 },
};

// Gráficos de cabeza indexados por headId (Cabezas.ind del AO).
// El GRH apunta a un solo frame PNG.
export const HEAD_GRAPHICS: Record<number, HeadFrame> = {
  1: { grh: 200 }, // masculino rubio
  2: { grh: 201 }, // femenino claro
  3: { grh: 202 }, // masculino oscuro (mago)
  4: { grh: 203 }, // femenino morena
  5: { grh: 204 }, // masculino pelirrojo
  6: { grh: 205 }, // masculino canoso (druida)
};

// Colores de fallback (cuando los PNG no están disponibles).
// Permiten renderizar una figura de color sólido por tipo de entidad.
export const BODY_FALLBACK_COLOR: Record<number, number> = {
  1:  0x4a7fc1, // Guerrero/Clérigo — azul
  2:  0x2e8b57, // Arquero/Asesino — verde
  3:  0x8b4ac8, // Mago/Druida — púrpura
  5:  0x228b22, // Dragón — verde oscuro
  7:  0x1a1a1a, // Araña — negro
  8:  0x8b4513, // Oso — marrón
  10: 0x808080, // Lobo — gris
  12: 0x4b0082, // Vampiro — índigo
  15: 0xd3d3d3, // Esqueleto — gris claro
  24: 0x556b2f, // Zombie — verde oliva
  25: 0x708090, // Trol — gris pizarra
  33: 0x6b8e23, // Goblin — verde oliva claro
  42: 0x8b6914, // Orco — marrón dorado
  71: 0xa0522d, // Rata — marrón rojizo
  97: 0x556b2f, // Víbora — verde oscuro
};

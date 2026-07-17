// AUTO-GENERADO por packages/server/scripts/parse-ao-dat.mjs
// Fuente: Dat/Hechizos.dat del AO Libre (github.com/ao-libre/ao-server). NO EDITAR A MANO.

export interface AoSpellDef {
  readonly id: number;
  readonly name: string;
  readonly magicWords: string;
  readonly manaCost: number;
  readonly staCost: number;
  readonly minSkill: number;
  readonly target: number; // 1 usuario · 2 npc · 3 ambos · 4 terreno
  readonly tipo: number;   // 1 HP/mana/sta · 2 estados · 3 invocación · 4 materializa · 5 metamorfosis
  readonly subeHp: number; // 1 cura · 2 daña
  readonly minHp: number;
  readonly maxHp: number;
  // WAV del hechizo (AUDIO/WAV del cliente original)
  readonly wav: number;
  // FX visual: índice en fxs.ini (FXgrh) y cantidad de loops
  readonly fxGrh: number;
  readonly loops: number;
  // Buffs: Celeridad (+AGI) / Fuerza (+STR). Bonus = RandomNumber(min,max); dura buffSeconds.
  readonly agiBoost?: number;
  readonly agiBoostMin?: number;
  readonly agiBoostMax?: number;
  readonly strBoost?: number;
  readonly strBoostMin?: number;
  readonly strBoostMax?: number;
  readonly buffSeconds?: number;
  // Daño afectado por báculo (mago sin báculo pega 0.7×; con báculo (SDB+70)/100).
  readonly staffAffected?: boolean;
  readonly paraliza?: boolean;
  readonly inmoviliza?: boolean;
  readonly envenena?: boolean;
  readonly curaVeneno?: boolean;
  readonly invisibilidad?: boolean;
  readonly revivir?: boolean;
  readonly removerParalisis?: boolean;
  readonly ceguera?: boolean;
  readonly estupidez?: boolean;
}

export const AO_SPELLS: Record<number, AoSpellDef> = {
  1: { id: 1, name: "Antídoto Mágico", magicWords: "NIHIL VED", manaCost: 12, staCost: 1, minSkill: 10, target: 1, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 2, loops: 2, curaVeneno: true },
  2: { id: 2, name: "Dardo Mágico", magicWords: "OHL VOR PEK", manaCost: 10, staCost: 1, minSkill: 6, target: 3, tipo: 1, subeHp: 2, minHp: 2, maxHp: 5, wav: 114, fxGrh: 15, loops: 2 },
  3: { id: 3, name: "Curar Heridas Leves", magicWords: "CORP SANC", manaCost: 10, staCost: 1, minSkill: 15, target: 3, tipo: 1, subeHp: 1, minHp: 1, maxHp: 5, wav: 17, fxGrh: 0, loops: 0 },
  4: { id: 4, name: "Toxina", magicWords: "SERP XON IN", manaCost: 24, staCost: 3, minSkill: 20, target: 3, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 3, loops: 2, envenena: true },
  5: { id: 5, name: "Curar Heridas Graves", magicWords: "EN CORP SANCTIS", manaCost: 40, staCost: 5, minSkill: 38, target: 3, tipo: 1, subeHp: 1, minHp: 12, maxHp: 35, wav: 18, fxGrh: 9, loops: 0 },
  6: { id: 6, name: "Flecha Mágica", magicWords: "VAX PER", manaCost: 20, staCost: 2, minSkill: 12, target: 3, tipo: 1, subeHp: 2, minHp: 6, maxHp: 12, wav: 19, fxGrh: 33, loops: 0 },
  7: { id: 7, name: "Flecha Eléctrica", magicWords: "SUN VAP", manaCost: 40, staCost: 5, minSkill: 22, target: 3, tipo: 1, subeHp: 2, minHp: 12, maxHp: 20, wav: 19, fxGrh: 32, loops: 0 },
  8: { id: 8, name: "Proyectil Mágico", magicWords: "VAX IN TAR", manaCost: 45, staCost: 6, minSkill: 38, target: 3, tipo: 1, subeHp: 2, minHp: 30, maxHp: 35, wav: 111, fxGrh: 10, loops: 0 },
  9: { id: 9, name: "Paralizar", magicWords: "HOAX VORP", manaCost: 450, staCost: 65, minSkill: 60, target: 3, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 8, loops: 0, paraliza: true },
  10: { id: 10, name: "Devolver Movilidad", magicWords: "AN HOAX VORP", manaCost: 300, staCost: 44, minSkill: 45, target: 3, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 110, fxGrh: 0, loops: 0, removerParalisis: true },
  11: { id: 11, name: "Resucitar", magicWords: "AHIL KNÄ XÄR", manaCost: 550, staCost: 400, minSkill: 75, target: 1, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 20, fxGrh: 0, loops: 0, revivir: true },
  12: { id: 12, name: "Ataque de Hambre", magicWords: "ÔL AEX", manaCost: 20, staCost: 2, minSkill: 5, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 0, loops: 0 },
  13: { id: 13, name: "Terrible hambre de Igôr", magicWords: "ÛX'ÔL AEX", manaCost: 55, staCost: 7, minSkill: 35, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 0, loops: 0 },
  14: { id: 14, name: "Invisibilidad", magicWords: "", manaCost: 500, staCost: 72, minSkill: 87, target: 1, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 0, loops: 0, invisibilidad: true },
  15: { id: 15, name: "Tormenta de Fuego", magicWords: "EN VAX ON TAR", manaCost: 250, staCost: 29, minSkill: 60, target: 3, tipo: 1, subeHp: 2, minHp: 45, maxHp: 55, wav: 69, fxGrh: 7, loops: 0, staffAffected: true },
  16: { id: 16, name: "Llamado a la Naturaleza", magicWords: "Nature et worg", manaCost: 120, staCost: 16, minSkill: 40, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0 },
  17: { id: 17, name: "Llamado Nigromante", magicWords: "MoÎ cámus", manaCost: 400, staCost: 31, minSkill: 51, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0 },
  18: { id: 18, name: "Celeridad", magicWords: "YUP A'INC", manaCost: 40, staCost: 5, minSkill: 20, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 20, loops: 0, agiBoost: 5, agiBoostMin: 2, agiBoostMax: 5, buffSeconds: 48 },
  19: { id: 19, name: "Torpeza", magicWords: "ASYNC YUP A'INC", manaCost: 20, staCost: 2, minSkill: 20, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0 },
  20: { id: 20, name: "Fuerza", magicWords: "Ar A'kron", manaCost: 50, staCost: 6, minSkill: 35, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 112, fxGrh: 17, loops: 0, strBoost: 5, strBoostMin: 2, strBoostMax: 5, buffSeconds: 48 },
  21: { id: 21, name: "Debilidad", magicWords: "Xoom varp", manaCost: 45, staCost: 6, minSkill: 35, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0 },
  22: { id: 22, name: "Llamado a Uhkrul", magicWords: "Arg Zagañarak", manaCost: 1, staCost: 1, minSkill: 101, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0 },
  23: { id: 23, name: "Descarga Eléctrica", magicWords: "T'HY KOOOL", manaCost: 460, staCost: 67, minSkill: 85, target: 3, tipo: 1, subeHp: 2, minHp: 55, maxHp: 85, wav: 113, fxGrh: 11, loops: 0, staffAffected: true },
  24: { id: 24, name: "Inmovilizar", magicWords: "Är Prop s'uo", manaCost: 300, staCost: 44, minSkill: 60, target: 3, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 12, loops: 0, inmoviliza: true },
  25: { id: 25, name: "Apocalipsis", magicWords: "Rahma Nañarak O'al", manaCost: 1000, staCost: 131, minSkill: 100, target: 3, tipo: 1, subeHp: 2, minHp: 85, maxHp: 100, wav: 27, fxGrh: 13, loops: 0, staffAffected: true },
  26: { id: 26, name: "Invocar Elemental de Fuego", magicWords: "Fir Yur'rax", manaCost: 1100, staCost: 145, minSkill: 100, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 7, loops: 0 },
  27: { id: 27, name: "Invocar Elemental de Agua", magicWords: "Wata Mantra'rax", manaCost: 980, staCost: 131, minSkill: 100, target: 4, tipo: 4, subeHp: 2, minHp: 30, maxHp: 55, wav: 17, fxGrh: 7, loops: 0 },
  28: { id: 28, name: "Invocar Elemental de Tierra", magicWords: "Mu Mantra'rax", manaCost: 980, staCost: 131, minSkill: 90, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 7, loops: 0 },
  29: { id: 29, name: "Implorar Ayuda", magicWords: "Ar'Cos Mantra'rax", manaCost: 1, staCost: 1, minSkill: 101, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 7, loops: 0 },
  30: { id: 30, name: "Ceguera", magicWords: "CAE' XitA", manaCost: 1, staCost: 1, minSkill: 101, target: 1, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0, ceguera: true },
  31: { id: 31, name: "Aturdir", magicWords: "ASYNC GAM ALÛ", manaCost: 800, staCost: 76, minSkill: 30, target: 1, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0, estupidez: true },
  32: { id: 32, name: "Ira de Dios", magicWords: "La IRA de Dios", manaCost: 1, staCost: 1, minSkill: 100, target: 3, tipo: 1, subeHp: 2, minHp: 9999, maxHp: 9999, wav: 27, fxGrh: 26, loops: 0 },
  33: { id: 33, name: "Invocación de Ultratumba", magicWords: "Cörpse Dûm Ex", manaCost: 650, staCost: 60, minSkill: 62, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 0, loops: 0 },
  34: { id: 34, name: "Llamarada de Dragon", magicWords: "L´l\"am D´rg", manaCost: 1, staCost: 1, minSkill: 10, target: 1, tipo: 1, subeHp: 2, minHp: 170, maxHp: 230, wav: 27, fxGrh: 13, loops: 2 },
  35: { id: 35, name: "Flecha", magicWords: "", manaCost: 3000, staCost: 0, minSkill: 101, target: 1, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 10, fxGrh: 14, loops: 0 },
  36: { id: 36, name: "Tormenta Pretoriana", magicWords: "EN VAX ON TAR", manaCost: 520, staCost: 0, minSkill: 80, target: 3, tipo: 1, subeHp: 0, minHp: 0, maxHp: 0, wav: 27, fxGrh: 7, loops: 0 },
  37: { id: 37, name: "Flecha Cazador Pretoriano", magicWords: "", manaCost: 3000, staCost: 0, minSkill: 101, target: 3, tipo: 1, subeHp: 2, minHp: 130, maxHp: 160, wav: 10, fxGrh: 14, loops: 0 },
  38: { id: 38, name: "Remover Invisibilidad", magicWords: "AN ROHL ÙX MAÏO", manaCost: 0, staCost: 0, minSkill: 101, target: 0, tipo: 0, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 2, loops: 2 },
  39: { id: 39, name: "Paralizar NPCs", magicWords: "HOAX MANTRA", manaCost: 0, staCost: 0, minSkill: 101, target: 0, tipo: 0, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 8, loops: 0 },
  40: { id: 40, name: "Bendición de Sortilego", magicWords: "In Nomine Patris et Fili et Spiritus Sancti, Amén.", manaCost: 1, staCost: 1, minSkill: 101, target: 3, tipo: 1, subeHp: 1, minHp: 9999, maxHp: 9999, wav: 18, fxGrh: 9, loops: 9 },
  41: { id: 41, name: "Desaturdir", magicWords: "AN ASYNC GAM ALÛ", manaCost: 350, staCost: 44, minSkill: 45, target: 1, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 0, loops: 0 },
  42: { id: 42, name: "Mimetismo", magicWords: "Cimim Ux Maïo", manaCost: 800, staCost: 44, minSkill: 75, target: 3, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 0, loops: 0 },
  43: { id: 43, name: "El Ojo del Demiurgo", magicWords: "An MaÏo naq vïká", manaCost: 1, staCost: 1, minSkill: 101, target: 4, tipo: 2, subeHp: 0, minHp: 0, maxHp: 0, wav: 16, fxGrh: 3, loops: 6 },
  44: { id: 44, name: "Flecha Elfica", magicWords: "", manaCost: 10, staCost: 1, minSkill: 10, target: 1, tipo: 1, subeHp: 2, minHp: 30, maxHp: 35, wav: 65, fxGrh: 0, loops: 2 },
  45: { id: 45, name: "Drenar", magicWords: "", manaCost: 10, staCost: 1, minSkill: 10, target: 1, tipo: 1, subeHp: 2, minHp: 35, maxHp: 40, wav: 165, fxGrh: 35, loops: 2 },
  46: { id: 46, name: "Invocar Mascota", magicWords: "Tsälo Kai'Tor", manaCost: 0, staCost: 131, minSkill: 0, target: 4, tipo: 4, subeHp: 0, minHp: 0, maxHp: 0, wav: 17, fxGrh: 7, loops: 0 },
  47: { id: 47, name: "Flecha Ladrón Pretoriano", magicWords: "", manaCost: 3000, staCost: 0, minSkill: 101, target: 3, tipo: 1, subeHp: 2, minHp: 30, maxHp: 60, wav: 10, fxGrh: 14, loops: 0 },
  48: { id: 48, name: "Drenar Alma  (NPC)", magicWords: "", manaCost: 10000, staCost: 1, minSkill: 101, target: 1, tipo: 1, subeHp: 2, minHp: 200, maxHp: 220, wav: 165, fxGrh: 35, loops: 2 },
  49: { id: 49, name: "Apocalipsis (NPC)", magicWords: "Rahma Nañarak O'al", manaCost: 10000, staCost: 131, minSkill: 101, target: 3, tipo: 1, subeHp: 2, minHp: 170, maxHp: 190, wav: 27, fxGrh: 13, loops: 0, staffAffected: true },
  50: { id: 50, name: "Descarga Eléctrica (NPC)", magicWords: "T'HY KOOOL", manaCost: 460, staCost: 67, minSkill: 85, target: 3, tipo: 1, subeHp: 2, minHp: 150, maxHp: 170, wav: 113, fxGrh: 11, loops: 0, staffAffected: true },
};

export function getAoSpell(id: number): AoSpellDef | undefined {
  return AO_SPELLS[id];
}

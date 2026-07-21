/**
 * parse-ao-dat.mjs
 *
 * Parsea los archivos de datos del AO Libre (ao-libre/ao-server → Dat/):
 *   obj.dat      → packages/shared/src/items.generated.ts   (~1240 items reales)
 *   NPCs.dat     → packages/server/src/world/npcs.generated.ts (catálogo NPC real)
 *   Hechizos.dat → packages/shared/src/spells.generated.ts  (50 hechizos reales)
 *   Balance.dat  → packages/server/data/dat/balance.json    (modificadores por clase/raza)
 *
 * Formato: INI de VB6 en UTF-8. Comentarios con apóstrofe (línea completa
 * o después de espacios). Secciones [OBJ#] / [NPC#] / [HECHIZO#].
 *
 * Uso: node packages/server/scripts/parse-ao-dat.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DAT = resolve(__dirname, "../data/dat");
const SHARED_SRC = resolve(__dirname, "../../shared/src");
const SERVER_SRC = resolve(__dirname, "../src");

// ─── Parser INI genérico ─────────────────────────────────────────────────────
// Devuelve Map<sectionName, Map<key, value>>. Claves case-insensitive
// (se normalizan a lowercase). Comentarios: línea que empieza con ' o #,
// o cola tras "espacio + apóstrofe" (p. ej. `Drop1=414-1 'Piel de Lobo`).
function parseIni(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sections = new Map();
  let cur = null;

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("'") || line.startsWith("#")) continue;

    const sm = line.match(/^\[([^\]]+)\]/);
    if (sm) {
      cur = new Map();
      sections.set(sm[1].toUpperCase(), cur);
      continue;
    }
    if (!cur) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    let value = line.slice(eq + 1);
    // Comentario inline: espacio(s) + apóstrofe.
    const cm = value.match(/\s+'/);
    if (cm) value = value.slice(0, cm.index);
    cur.set(key, value.trim());
  }
  return sections;
}

const num = (map, key, fallback = 0) => {
  const v = map.get(key);
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (map, key, fallback = "") => map.get(key) ?? fallback;

// Escapa string para literal TS con comillas dobles.
const q = (s) => JSON.stringify(s);

// ─── 1. obj.dat → items.generated.ts ────────────────────────────────────────
// ObjType del AO clásico:
//   1 comida · 2 armas · 3 armaduras · 5 dinero · 11 pociones · 13 bebidas
//   16 escudos · 17 cascos · resto → misc
const OBJTYPE_TO_TYPE = {
  1: "food",
  2: "weapon",
  3: "armor",
  11: "potion",
  13: "drink",
  16: "shield",
  17: "helmet",
  32: "arrow",
};

function generateItems() {
  const ini = parseIni(resolve(DAT, "obj.dat"));
  const lines = [];
  let count = 0;
  const byType = {};

  for (const [section, m] of ini) {
    const sm = section.match(/^OBJ(\d+)$/);
    if (!sm) continue;
    const id = parseInt(sm[1]);
    const name = str(m, "name");
    if (!name) continue;

    const objType = num(m, "objtype");
    const type = OBJTYPE_TO_TYPE[objType] ?? "misc";
    const graphic = num(m, "grhindex");
    const value = num(m, "valor");

    const parts = [
      `id: ${id}`,
      `name: ${q(name)}`,
      `type: ${q(type)}`,
      `objType: ${objType}`,
      `value: ${value}`,
      `graphic: ${graphic}`,
    ];

    // Trabajos: costos de herrería (lingotes + skill) y carpintería (madera).
    const skHerreria = num(m, "skherreria");
    if (skHerreria > 0) {
      parts.push(`skHerreria: ${skHerreria}`);
      parts.push(`lingH: ${num(m, "lingh")}`, `lingP: ${num(m, "lingp")}`, `lingO: ${num(m, "lingo")}`);
    }
    const madera = num(m, "madera");
    if (madera > 0) {
      parts.push(`madera: ${madera}`, `skCarpinteria: ${num(m, "skcarpinteria")}`);
    }
    // Yacimientos: qué mineral dan.
    const mineralIndex = num(m, "mineralindex");
    if (mineralIndex > 0) parts.push(`mineralIndex: ${mineralIndex}`);
    // Barcos (objType 31): body al navegar + skill de Navegación mínima.
    if (objType === 31) {
      const ropaje = num(m, "numropaje") || num(m, "ropaje");
      if (ropaje > 0) parts.push(`bodyId: ${ropaje}`);
      parts.push(`minSkillNav: ${num(m, "minskill")}`);
    }
    // Monturas (objType 25): body al equitar (DoEquita del Trabajo.bas).
    if (objType === 25) {
      const ropaje = num(m, "numropaje") || num(m, "ropaje");
      if (ropaje > 0) parts.push(`bodyId: ${ropaje}`);
    }
    // Carteles (objType 8): texto que muestran (AccionParaCartel).
    if (objType === 8) {
      const texto = str(m, "texto");
      if (texto) parts.push(`texto: ${q(texto)}`);
    }
    // Pergaminos (objType 24): HechizoIndex → hechizo que enseñan al usarlos.
    if (objType === 24) {
      const hechizo = num(m, "hechizoindex");
      if (hechizo > 0) parts.push(`spellId: ${hechizo}`);
    }
    // Puertas (objType 6): estado + contrapartes (AccionParaPuerta).
    if (objType === 6) {
      if (num(m, "cerrada") === 1) parts.push(`cerrada: true`);
      const llave = num(m, "llave");
      if (llave > 0) parts.push(`llave: ${llave}`);
      parts.push(`indexAbierta: ${num(m, "indexabierta")}`, `indexCerrada: ${num(m, "indexcerrada")}`);
    }

    // Overlay visual al equipar (Armas.dat/Escudos.dat/Cascos.ini del cliente).
    if (type === "weapon" || type === "shield" || type === "helmet") {
      const anim = num(m, "anim");
      if (anim > 0) parts.push(`anim: ${anim}`);
    }
    if (type === "weapon") {
      const minHit = num(m, "minhit");
      const maxHit = num(m, "maxhit");
      parts.push(`minHit: ${minHit}`, `maxHit: ${maxHit}`);
      parts.push(`damageBonus: ${Math.round((minHit + maxHit) / 2)}`);
      // Báculo del mago: bonus de daño mágico (dano×(SDB+70)/100).
      const sdb = num(m, "staffdamagebonus");
      if (sdb > 0) parts.push(`staffDamageBonus: ${sdb}`);
      if (num(m, "apunala") === 1) parts.push(`stabs: true`);
      if (num(m, "proyectil") === 1) parts.push(`ranged: true`);
      if (num(m, "municiones") === 1 || num(m, "municion") === 1) parts.push(`needsAmmo: true`);
    }
    if (type === "arrow") {
      parts.push(`minHit: ${num(m, "minhit")}`, `maxHit: ${num(m, "maxhit")}`);
    }
    if (type === "armor" || type === "shield" || type === "helmet") {
      const minDef = num(m, "mindef");
      const maxDef = num(m, "maxdef");
      // AO tira RandomNumber(MinDef,MaxDef) en cada golpe; guardamos rango + promedio.
      parts.push(`defense: ${Math.round((minDef + maxDef) / 2)}`, `defenseMin: ${minDef}`, `defenseMax: ${maxDef}`);
      // Defensa mágica (cascos antimagia): resta RandomNumber(min,max) al daño de hechizo.
      const magMax = num(m, "defensamagicamax");
      if (magMax > 0) parts.push(`magicDefMin: ${num(m, "defensamagicamin")}`, `magicDefMax: ${magMax}`);
    }
    if (type === "armor") {
      const ropaje = num(m, "numropaje");
      if (ropaje > 0) parts.push(`bodyId: ${ropaje}`);
    }
    if (type === "potion") {
      const tipoPocion = num(m, "tipopocion");
      const minMod = num(m, "minmodificador");
      const maxMod = num(m, "maxmodificador");
      // Duración de las drogas: DuracionEfecto está en ticks (~40ms del AO).
      const boostSec = Math.max(1, Math.round(num(m, "duracionefecto", 1000) * 0.04));
      // Salud (3): cura RandomNumber(Min,Max). Rango + promedio.
      if (tipoPocion === 3 && maxMod > 0) {
        parts.push(`heal: ${Math.round((minMod + maxMod) / 2)}`, `healMin: ${minMod > 0 ? minMod : maxMod}`, `healMax: ${maxMod}`);
      }
      // Maná (4): NO usa modificador; fórmula propia (4%maxMana + nivel/2 + 40/nivel).
      if (tipoPocion === 4) parts.push(`restoresMana: true`);
      // Cura veneno (5): Poción Violeta.
      if (tipoPocion === 5) parts.push(`curesPoison: true`);
      // Drogas: 1 = agilidad (Poción Amarilla), 2 = fuerza (Poción Verde). +RandomNumber(Min,Max).
      if (tipoPocion === 1 && maxMod > 0) {
        parts.push(`agiBoost: ${Math.round((minMod + maxMod) / 2)}`, `agiBoostMin: ${minMod > 0 ? minMod : maxMod}`, `agiBoostMax: ${maxMod}`, `boostSeconds: ${boostSec}`);
      }
      if (tipoPocion === 2 && maxMod > 0) {
        parts.push(`strBoost: ${Math.round((minMod + maxMod) / 2)}`, `strBoostMin: ${minMod > 0 ? minMod : maxMod}`, `strBoostMax: ${maxMod}`, `boostSeconds: ${boostSec}`);
      }
    }
    if (type === "food") {
      const ham = num(m, "minham");
      if (ham > 0) parts.push(`hunger: ${ham}`);
    }
    if (type === "drink") {
      // obj.dat: la sed que restaura es MinAgu (NO "MinSed", que no existe);
      // las bebidas además dan energía (MinST → stamina).
      const agu = num(m, "minagu");
      const st = num(m, "minst");
      if (agu > 0) parts.push(`thirst: ${agu}`);
      if (st > 0) parts.push(`stamina: ${st}`);
    }
    if (num(m, "newbie") === 1) parts.push(`newbie: true`);

    // Clases prohibidas (CP1..CPn del obj.dat, por NOMBRE) → ids de las 6 clases
    // del port. Los nombres de clases que este port no tiene (Pirata, Bardo, etc.)
    // se ignoran. Se usa al equipar en handleUseItem.
    const CLASS_BY_NAME = { GUERRERO: 1, MAGO: 2, CLERIGO: 3, CAZADOR: 4, ASESINO: 5, DRUIDA: 6 };
    const forbidden = new Set();
    for (let i = 1; i <= 20; i++) {
      const cn = str(m, `cp${i}`).trim().toUpperCase();
      if (!cn) continue;
      const cid = CLASS_BY_NAME[cn];
      if (cid) forbidden.add(cid);
    }
    if (forbidden.size > 0) {
      parts.push(`forbiddenClasses: [${[...forbidden].sort((a, b) => a - b).join(", ")}]`);
    }

    lines.push(`  ${id}: { ${parts.join(", ")} },`);
    count++;
    byType[type] = (byType[type] ?? 0) + 1;
  }

  const out = `// AUTO-GENERADO por packages/server/scripts/parse-ao-dat.mjs
// Fuente: Dat/obj.dat del AO Libre (github.com/ao-libre/ao-server). NO EDITAR A MANO.
import type { ItemDef } from "./items.js";

export const ITEMS: Record<number, ItemDef> = {
${lines.join("\n")}
};
`;
  writeFileSync(resolve(SHARED_SRC, "items.generated.ts"), out);
  console.log(`✓ items.generated.ts: ${count} items — ${JSON.stringify(byType)}`);
}

// ─── 2. NPCs.dat → npcs.generated.ts ────────────────────────────────────────
function generateNpcs() {
  const ini = parseIni(resolve(DAT, "NPCs.dat"));
  const lines = [];
  let count = 0;

  for (const [section, m] of ini) {
    const sm = section.match(/^NPC(\d+)$/);
    if (!sm) continue;
    const number = parseInt(sm[1]);
    const name = str(m, "name");
    if (!name) continue;

    const npcType = num(m, "npctype");
    const hostile = num(m, "hostile") === 1;
    const comercia = num(m, "comercia") === 1;
    const attackable = num(m, "attackable") === 1;
    const movement = num(m, "movement", 1);
    const maxHp = Math.max(1, num(m, "maxhp", 1));

    // Inventario del comerciante: Obj1..ObjN = "itemIndex-cantidad"
    const shopItems = [];
    if (comercia) {
      const n = num(m, "nroitems");
      for (let i = 1; i <= n; i++) {
        const raw = str(m, `obj${i}`);
        const om = raw.match(/^(\d+)-/);
        if (om) shopItems.push(parseInt(om[1]));
      }
    }

    // Drops: Drop1..DropN = "itemIndex-cantidad"
    const drops = [];
    for (let i = 1; i <= 10; i++) {
      const raw = m.get(`drop${i}`);
      if (!raw) continue;
      const dm = raw.match(/^(\d+)-(\d+)/);
      if (dm) drops.push({ item: parseInt(dm[1]), qty: parseInt(dm[2]) });
    }

    // Sonidos del NPC (Snd1/2/3 de NPCs.dat): los reproduce al atacar y al morir.
    const sounds = [];
    for (let i = 1; i <= 3; i++) {
      const s = num(m, `snd${i}`);
      if (s > 0) sounds.push(s);
    }

    const parts = [
      `name: ${q(name)}`,
      `body: ${num(m, "body")}`,
      `head: ${num(m, "head")}`,
      `npcType: ${npcType}`,
      `hostile: ${hostile}`,
      `attackable: ${attackable}`,
      `comercia: ${comercia}`,
      `movement: ${movement}`,
      `maxHp: ${maxHp}`,
      `minHit: ${num(m, "minhit")}`,
      `maxHit: ${num(m, "maxhit")}`,
      `def: ${num(m, "def")}`,
      `giveExp: ${num(m, "giveexp")}`,
      `giveGld: ${num(m, "givegld")}`,
      `poderAtaque: ${num(m, "poderataque")}`,
      `poderEvasion: ${num(m, "poderevasion")}`,
    ];
    const questNumber = num(m, "questnumber");
    if (questNumber > 0) parts.push(`questNumber: ${questNumber}`);
    // Domable: puntos de doma requeridos (DoDomar del Trabajo.bas).
    const domable = num(m, "domable");
    if (domable > 0) parts.push(`domable: ${domable}`);
    // Criatura marina (TierraInValida=1): solo se mueve en agua, no pisa tierra.
    if (num(m, "tierrainvalida") === 1) parts.push(`waterOnly: true`);
    if (shopItems.length > 0) parts.push(`shopItems: [${shopItems.join(", ")}]`);
    if (drops.length > 0) {
      parts.push(`drops: [${drops.map((d) => `{ item: ${d.item}, qty: ${d.qty} }`).join(", ")}]`);
    }
    if (sounds.length > 0) parts.push(`sounds: [${sounds.join(", ")}]`);

    lines.push(`  ${number}: { ${parts.join(", ")} },`);
    count++;
  }

  const out = `// AUTO-GENERADO por packages/server/scripts/parse-ao-dat.mjs
// Fuente: Dat/NPCs.dat del AO Libre (github.com/ao-libre/ao-server). NO EDITAR A MANO.

export interface NpcDefData {
  readonly name: string;
  readonly body: number;
  readonly head: number;
  // 0 común · 1 resucitador · 2 guardia real · 3 entrenador · 4 banquero
  // 5 noble · 6 dragón · 8 guardia caos · 10 pretoriano · 11 gobernador
  readonly npcType: number;
  readonly hostile: boolean;
  readonly attackable: boolean;
  readonly comercia: boolean;
  // 1 = estático, otros = se mueve (3 = hostil que persigue)
  readonly movement: number;
  readonly maxHp: number;
  readonly minHit: number;
  readonly maxHit: number;
  readonly def: number;
  readonly giveExp: number;
  readonly giveGld: number;
  // Combate del AO original (NPCs.dat): probabilidad de impacto/evasión.
  readonly poderAtaque: number;
  readonly poderEvasion: number;
  // NPC de misiones: número de quest que ofrece (Quests.DAT).
  readonly questNumber?: number;
  // Domable (DoDomar): puntos de doma requeridos; ausente = no domable.
  readonly domable?: number;
  // Criatura marina (TierraInValida=1): solo se mueve en agua, no pisa tierra.
  readonly waterOnly?: boolean;
  readonly shopItems?: readonly number[];
  readonly drops?: ReadonlyArray<{ readonly item: number; readonly qty: number }>;
  // Sonidos del NPC (Snd1/2/3): se reproducen al atacar y al morir la criatura.
  readonly sounds?: readonly number[];
}

export const NPC_DEFS: Record<number, NpcDefData> = {
${lines.join("\n")}
};
`;
  writeFileSync(resolve(SERVER_SRC, "world/npcs.generated.ts"), out);
  console.log(`✓ npcs.generated.ts: ${count} NPCs`);
}

// ─── 3. Hechizos.dat → spells.generated.ts ──────────────────────────────────
function generateSpells() {
  const ini = parseIni(resolve(DAT, "Hechizos.dat"));
  const lines = [];
  let count = 0;

  for (const [section, m] of ini) {
    const sm = section.match(/^HECHIZO(\d+)$/);
    if (!sm) continue;
    const id = parseInt(sm[1]);
    const name = str(m, "nombre");
    if (!name) continue;

    const parts = [
      `id: ${id}`,
      `name: ${q(name)}`,
      `magicWords: ${q(str(m, "palabrasmagicas"))}`,
      `manaCost: ${num(m, "manarequerido")}`,
      `staCost: ${num(m, "starequerido")}`,
      `minSkill: ${num(m, "minskill")}`,
      // 1 usuario · 2 npc · 3 ambos · 4 terreno
      `target: ${num(m, "target")}`,
      // 1 HP/mana/sta · 2 estados · 3 invocación · 4 materializa · 5 metamorfosis
      `tipo: ${num(m, "tipo")}`,
      `subeHp: ${num(m, "subehp")}`,
      `minHp: ${num(m, "minhp")}`,
      `maxHp: ${num(m, "maxhp")}`,
      `wav: ${num(m, "wav")}`,
      `fxGrh: ${num(m, "fxgrh")}`,
      `loops: ${num(m, "loops")}`,
    ];
    // Buffs de stats (Celeridad = SubeAG, Fuerza = SubeFU): +RandomNumber(Min,Max).
    // Duración DuracionEfecto (ticks ~40ms → segundos).
    const buffSec = Math.max(1, Math.round(num(m, "duracionefecto", 1200) * 0.04));
    if (num(m, "subeag") === 1) {
      parts.push(`agiBoost: ${num(m, "maxag")}`, `agiBoostMin: ${num(m, "minag")}`, `agiBoostMax: ${num(m, "maxag")}`, `buffSeconds: ${buffSec}`);
    }
    if (num(m, "subefu") === 1) {
      parts.push(`strBoost: ${num(m, "maxfu")}`, `strBoostMin: ${num(m, "minfu")}`, `strBoostMax: ${num(m, "maxfu")}`, `buffSeconds: ${buffSec}`);
    }
    // Daño afectado por báculo (mago sin báculo pega 0.7×).
    if (num(m, "staffaffected") === 1) parts.push(`staffAffected: true`);
    const flags = [
      ["paraliza", "paraliza"], ["inmoviliza", "inmoviliza"], ["envenena", "envenena"],
      ["curaVeneno", "curaveneno"], ["invisibilidad", "invisibilidad"],
      ["revivir", "revivir"], ["removerParalisis", "removerparalisis"],
      ["ceguera", "ceguera"], ["estupidez", "estupidez"],
    ];
    for (const [tsKey, iniKey] of flags) {
      if (num(m, iniKey) === 1) parts.push(`${tsKey}: true`);
    }

    lines.push(`  ${id}: { ${parts.join(", ")} },`);
    count++;
  }

  const out = `// AUTO-GENERADO por packages/server/scripts/parse-ao-dat.mjs
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
${lines.join("\n")}
};

export function getAoSpell(id: number): AoSpellDef | undefined {
  return AO_SPELLS[id];
}
`;
  writeFileSync(resolve(SHARED_SRC, "spells.generated.ts"), out);
  console.log(`✓ spells.generated.ts: ${count} hechizos`);
}

// ─── 3b. Quests.DAT → quests.generated.ts ───────────────────────────────────
function generateQuests() {
  const ini = parseIni(resolve(DAT, "Quests.DAT"));
  const lines = [];
  let count = 0;

  for (const [section, m] of ini) {
    const sm = section.match(/^QUEST(\d+)$/);
    if (!sm) continue;
    const id = parseInt(sm[1]);
    const nombre = str(m, "nombre");
    if (!nombre) continue;

    const npcs = [];
    const nNpcs = num(m, "requirednpcs");
    for (let i = 1; i <= nNpcs; i++) {
      const raw = str(m, `requirednpc${i}`);
      const mm = raw.match(/^(\d+)-(\d+)/);
      if (mm) npcs.push(`{ npc: ${mm[1]}, amount: ${mm[2]} }`);
    }
    const objs = [];
    const nObjs = num(m, "requiredobjs");
    for (let i = 1; i <= nObjs; i++) {
      const raw = str(m, `requiredobj${i}`);
      const mm = raw.match(/^(\d+)-(\d+)/);
      if (mm) objs.push(`{ item: ${mm[1]}, amount: ${mm[2]} }`);
    }
    const rewards = [];
    const nRew = num(m, "rewardobjs");
    for (let i = 1; i <= nRew; i++) {
      const raw = str(m, `rewardobj${i}`);
      const mm = raw.match(/^(\d+)-(\d+)/);
      if (mm) rewards.push(`{ item: ${mm[1]}, amount: ${mm[2]} }`);
    }

    lines.push(`  ${id}: { id: ${id}, nombre: ${q(nombre)}, desc: ${q(str(m, "desc"))}, requiredLevel: ${num(m, "requiredlevel", 1)}, npcs: [${npcs.join(", ")}], objs: [${objs.join(", ")}], rewardGld: ${num(m, "rewardgld")}, rewardExp: ${num(m, "rewardexp")}, rewardObjs: [${rewards.join(", ")}] },`);
    count++;
  }

  const out = `// AUTO-GENERADO por packages/server/scripts/parse-ao-dat.mjs
// Fuente: Dat/Quests.DAT del AO Libre. NO EDITAR A MANO.

export interface QuestDef {
  readonly id: number;
  readonly nombre: string;
  readonly desc: string;
  readonly requiredLevel: number;
  readonly npcs: ReadonlyArray<{ readonly npc: number; readonly amount: number }>;
  readonly objs: ReadonlyArray<{ readonly item: number; readonly amount: number }>;
  readonly rewardGld: number;
  readonly rewardExp: number;
  readonly rewardObjs: ReadonlyArray<{ readonly item: number; readonly amount: number }>;
}

export const QUESTS: Record<number, QuestDef> = {
${lines.join("\n")}
};
`;
  writeFileSync(resolve(SHARED_SRC, "quests.generated.ts"), out);
  console.log(`✓ quests.generated.ts: ${count} misiones`);
}

// ─── 4. Balance.dat → balance.json ──────────────────────────────────────────
function generateBalance() {
  const ini = parseIni(resolve(DAT, "Balance.dat"));
  const out = {};
  for (const [section, m] of ini) {
    out[section] = Object.fromEntries(
      [...m.entries()].map(([k, v]) => [k, parseFloat(v)]),
    );
  }
  writeFileSync(resolve(DAT, "balance.json"), JSON.stringify(out, null, 2));
  console.log(`✓ balance.json: secciones ${Object.keys(out).join(", ")}`);
}

generateItems();
generateNpcs();
generateSpells();
generateQuests();
generateBalance();
console.log("\nListo. Recordá correr typecheck: npx tsc -b packages/shared packages/server --noEmit");

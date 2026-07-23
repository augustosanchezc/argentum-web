import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Direction, Vector2 } from "@ao/shared";
import { getMap, isWalkable, loadedMapIds } from "./maps.js";
import { NPC_DEFS, type NpcDefData } from "./npcs.generated.js";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";
import { isNpcDeleted } from "./npc-deletions.js";
import { storedGmNpcs } from "./gm-npcs.js";

export const NPC_ID_BASE = 1_000_000;

export function isNpcId(id: number): boolean {
  return id >= NPC_ID_BASE;
}

export interface NpcDrop {
  readonly item: number;
  readonly qty: number;
  readonly chance: number;
}

// Tipo de NPC en runtime. Se construye desde NPC_DEFS (NPCs.dat real del AO)
// en toNpcType(). Los campos de timing/aggro no están en el .dat original
// (el server VB6 los tenía hardcodeados) — usamos equivalentes fieles.
export interface NpcType {
  readonly number: number; // número de NPC en NPCs.dat
  readonly name: string;
  readonly bodyId: number;
  readonly headId: number;
  readonly maxHp: number;
  readonly damageMin: number;
  readonly damageMax: number;
  readonly defense: number;
  readonly attackCooldownMs: number;
  readonly aggroRadius: number;
  readonly moveCooldownMs: number;
  readonly canMove: boolean;
  readonly xpReward: number;
  readonly respawnMs: number;
  readonly hostile: boolean;
  readonly attackable: boolean;
  readonly merchant: boolean;
  readonly banker: boolean;
  // Criatura de caza (NpcType=0, no comercia): lo que sí puede randomizarse en
  // el respawn por mapa. Excluye guardias, sacerdotes, comerciantes, banqueros.
  readonly isCreature: boolean;
  // Guardia real: solo ataca a jugadores criminales.
  readonly isGuard: boolean;
  // Sacerdote (NpcType=1): revive y cura al interactuar o al acercarse.
  readonly isPriest: boolean;
  // NPC de misiones: quest que ofrece (0 = ninguna).
  readonly questNumber: number;
  // Probabilidad de impacto/evasión del AO (NPCs.dat).
  readonly poderAtaque: number;
  readonly poderEvasion: number;
  // Domable (DoDomar): puntos de doma requeridos (0 = no domable).
  readonly domable: number;
  // Criatura marina (TierraInValida): solo se mueve en agua, no pisa tierra.
  readonly waterOnly: boolean;
  readonly goldMin: number;
  readonly goldMax: number;
  readonly drops: readonly NpcDrop[];
  readonly shopOffers: readonly number[];
  // Sonidos de la criatura (Snd1/2/3 de NPCs.dat): al atacar y al morir.
  readonly sounds: readonly number[];
}

// Item de oro (iORO del AO). El oro de un NPC viene de dos fuentes de NPCs.dat:
// (1) el campo GiveGLD (NPCTirarOro lo tira FIJO, sin aleatoriedad) — lo usan
// pocos NPCs; (2) entradas de item 12 en la tabla Drop, que usan la mayoría de
// las criaturas (GiveGLD=0). Acreditamos ambas al matador.
export const GOLD_ITEM = 12;

// AO Libre carga los drops SIN campo de probabilidad (tDrops = {ObjIndex, Amount});
// el sub NPC_TIRAR_ITEMS que decide la chance NO está en la fuente open source
// disponible. Pero el patrón de datos lo delata: muchas criaturas tienen VARIAS
// entradas de oro con montos crecientes (ej. Murciélago 1/2/15/70, Gorila
// 1200/7500) — o sea "monto chico frecuente, jackpot raro". Eso implica una
// probabilidad DECRECIENTE por posición en la tabla. Usamos ese esquema (nuestro,
// tuneable por drop desde el panel admin, ya que el número exacto no es portable).
const DROP_CHANCES = [0.6, 0.35, 0.2, 0.1, 0.05];

function toNpcType(number: number, d: NpcDefData): NpcType {
  const banker = d.npcType === 4;
  const merchant = d.comercia && !banker;
  const isGuard = d.npcType === 2;
  // Guardias (2) persiguen criminales; guardias del caos (8) atacan a todos.
  const hostile = d.hostile || isGuard || d.npcType === 8;
  const canMove = d.movement !== 1;

  const drops: NpcDrop[] = (d.drops ?? []).map((drop, i) => ({
    item: drop.item,
    qty: drop.qty,
    // Chance por posición (override-able por drop desde el panel admin).
    chance: (drop as { chance?: number }).chance ?? DROP_CHANCES[i] ?? 0.05,
  }));

  return {
    number,
    name: d.name,
    bodyId: d.body,
    headId: d.head,
    maxHp: d.maxHp,
    damageMin: d.minHit,
    damageMax: Math.max(d.minHit, d.maxHit),
    defense: d.def,
    attackCooldownMs: 1_600, // IntervaloNpcPuedeAtacar del Server.ini

    // Radio de detección/persecución (chebyshev). Mayor que el rango visual del
    // jugador (~10 tiles a lo ancho, ~7 a lo alto) para que las criaturas
    // empiecen a perseguir ANTES de entrar en pantalla.
    aggroRadius: isGuard ? 18 : 15,
    moveCooldownMs: hostile ? 450 : 700,
    canMove,
    xpReward: d.giveExp,
    // Respawn INSTANTÁNEO (decisión de diseño): al morir una criatura, reaparece
    // en un tile aleatorio del mapa en el siguiente tick (ver processNpcs).
    respawnMs: 0,
    hostile,
    attackable: d.attackable,
    merchant,
    banker,
    isCreature: d.npcType === 0 && !d.comercia,
    isGuard,
    isPriest: d.npcType === 1,
    questNumber: d.questNumber ?? 0,
    poderAtaque: d.poderAtaque,
    poderEvasion: d.poderEvasion,
    domable: d.domable ?? 0,
    waterOnly: d.waterOnly ?? false,
    // NPCTirarOro del AO tira GiveGLD FIJO (sin rango aleatorio): goldMin==goldMax.
    goldMin: d.giveGld,
    goldMax: d.giveGld,
    drops,
    shopOffers: d.shopItems ?? [],
    sounds: d.sounds ?? [],
  };
}

// Elige al azar uno de los sonidos de la criatura (Snd1/2/3), 0 si no tiene.
export function randomNpcSound(type: NpcType): number {
  if (type.sounds.length === 0) return 0;
  return type.sounds[Math.floor(Math.random() * type.sounds.length)] ?? 0;
}

// Canon del AO (MODULO_NPCs.bas): Snd1 = al atacar · Snd3 = al morir.
export function npcAttackSound(type: NpcType): number {
  return type.sounds[0] ?? 0;
}
export function npcDeathSound(type: NpcType): number {
  return type.sounds[2] ?? type.sounds[0] ?? 0;
}

// Cache de NpcType por número de NPCs.dat.
const typeCache = new Map<number, NpcType>();

// ── Overrides editables desde el panel de administración ──────────────────
// Las definiciones base salen de NPCs.dat (npcs.generated). El admin puede
// sobreescribir campos por número; se guardan en un JSON y se mergean sobre la
// base. Al editar se limpia el cache para que los NPCs que aparezcan después
// usen los nuevos valores (los ya spawneados toman los cambios al respawnear).
const OVERRIDES_PATH = overridePath("npc-overrides.json");
const npcOverrides = new Map<number, Partial<NpcDefData>>();
try {
  const text = readOverrideOrSeed("npc-overrides.json");
  if (text) {
    const obj = JSON.parse(text) as Record<string, Partial<NpcDefData>>;
    for (const [k, v] of Object.entries(obj)) npcOverrides.set(Number(k), v);
  }
} catch {
  // sin overrides todavía
}

function persistNpcOverrides(): void {
  const obj: Record<string, Partial<NpcDefData>> = {};
  for (const [k, v] of npcOverrides) obj[k.toString()] = v;
  try {
    mkdirSync(dirname(OVERRIDES_PATH), { recursive: true });
    writeFileSync(OVERRIDES_PATH, JSON.stringify(obj, null, 2));
  } catch {
    // disco de solo lectura: los cambios viven en memoria hasta reiniciar
  }
}

// Definición efectiva (base de NPCs.dat + override del admin).
export function getEffectiveNpcDef(number: number): NpcDefData | undefined {
  const base = NPC_DEFS[number];
  if (!base) return undefined;
  const ov = npcOverrides.get(number);
  return ov ? { ...base, ...ov } : base;
}

export function getNpcOverride(number: number): Partial<NpcDefData> | undefined {
  return npcOverrides.get(number);
}

// Aplica un override parcial y lo persiste. Devuelve la def efectiva o null.
export function setNpcOverride(number: number, patch: Partial<NpcDefData>): NpcDefData | null {
  if (!NPC_DEFS[number]) return null;
  npcOverrides.set(number, { ...(npcOverrides.get(number) ?? {}), ...patch });
  typeCache.delete(number); // se reconstruye con los nuevos valores
  persistNpcOverrides();
  return getEffectiveNpcDef(number) ?? null;
}

// Elimina el override de experiencia (giveExp) de TODAS las criaturas, dejando
// el valor original de NPCs.dat. Los demás overrides (nombre, hp, drops, oro…)
// se conservan. Si un NPC sólo tenía override de exp, se borra por completo.
// Devuelve la cantidad de NPCs afectados.
export function resetAllNpcExp(): number {
  let count = 0;
  for (const [number, ov] of npcOverrides) {
    if (ov.giveExp === undefined) continue;
    const rest = { ...ov };
    delete rest.giveExp;
    if (Object.keys(rest).length === 0) npcOverrides.delete(number);
    else npcOverrides.set(number, rest);
    typeCache.delete(number);
    count++;
  }
  persistNpcOverrides();
  return count;
}

export function getNpcType(number: number): NpcType | undefined {
  const cached = typeCache.get(number);
  if (cached) return cached;
  const def = getEffectiveNpcDef(number);
  if (!def) return undefined;
  const t = toNpcType(number, def);
  typeCache.set(number, t);
  return t;
}

export interface NpcInstance {
  readonly id: number;
  // Mutable: el respawn aleatorio por mapa puede cambiar la criatura (map-spawns).
  type: NpcType;
  readonly mapId: number;
  readonly spawn: Vector2;
  position: Vector2;
  direction: Direction;
  hp: number;
  deadUntil: number;
  // Paralizado/inmovilizado por hechizo (epoch ms, 0 = libre).
  paralyzedUntil: number;
  lastMoveAt: number;
  lastAttackAt: number;
  targetCharacterId: number | null;
  // Mascota (DoDomar): personaje amo y NPC objetivo al que asiste.
  ownerCharacterId: number | null;
  petTargetNpcId: number | null;
  // Invocado por un GM (/invocar): persistido en gm-npcs.json, se re-crea al
  // arrancar y solo un GM lo puede sacar (/eliminarnpc).
  gmSpawned: boolean;
}

function findWalkableNear(mapId: number, origin: Vector2, waterOnly = false): Vector2 {
  const map = getMap(mapId);
  if (!map) return origin;
  // waterOnly (criatura marina): "caminable" = agua, para no relocalizarla a tierra.
  if (isWalkable(map, origin.x, origin.y, waterOnly)) return origin;
  for (let r = 1; r < 12; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (isWalkable(map, x, y, waterOnly)) return { x, y };
      }
    }
  }
  return origin;
}

class NpcRegistry {
  private readonly byId = new Map<number, NpcInstance>();
  private nextId = NPC_ID_BASE + 1;

  // Puebla el mundo desde los .inf de los mapas cargados: cada tile con
  // npcIndex spawnea el NPC de NPCs.dat correspondiente — la población
  // real del AO original (comerciantes, guardias y criaturas incluidos).
  init(): void {
    if (this.byId.size > 0) return;
    let spawned = 0;
    let unknown = 0;
    for (const mapId of loadedMapIds()) {
      const map = getMap(mapId);
      if (!map) continue;
      for (const s of map.npcSpawns) {
        const type = getNpcType(s.npcNumber);
        if (!type) {
          unknown++;
          continue;
        }
        const pos = findWalkableNear(mapId, { x: s.x, y: s.y }, type.waterOnly);
        // Salteamos los NPCs que un GM eliminó (/eliminarnpc) — persistido en el
        // volumen para que la eliminación sobreviva a los redeploy.
        if (isNpcDeleted(mapId, s.npcNumber, pos.x, pos.y)) continue;
        const id = this.nextId++;
        this.byId.set(id, {
          id, type, mapId,
          spawn: { x: pos.x, y: pos.y },
          position: { x: pos.x, y: pos.y },
          direction: "south",
          hp: type.maxHp,
          deadUntil: 0,
          paralyzedUntil: 0,
          lastMoveAt: 0,
          lastAttackAt: 0,
          targetCharacterId: null,
          ownerCharacterId: null,
          petTargetNpcId: null,
          gmSpawned: false,
        });
        spawned++;
      }
    }
    // Re-invocamos los NPCs que un GM sumó con /invocar (persistidos en el
    // volumen) para que sobrevivan al reinicio/redeploy.
    let gmRestored = 0;
    for (const g of storedGmNpcs()) {
      if (this.spawnAt(g.npcNumber, g.mapId, { x: g.x, y: g.y }, true)) gmRestored++;
    }
    if (gmRestored > 0) console.log(`[npcs] ${gmRestored.toString()} NPCs de GM (/invocar) restaurados`);
    console.log(
      `[npcs] ${spawned.toString()} NPCs spawneados desde los .inf de ${loadedMapIds().length.toString()} mapas` +
      (unknown > 0 ? ` (${unknown.toString()} npcIndex sin entrada en NPCs.dat, ignorados)` : ""),
    );
  }

  get(id: number): NpcInstance | undefined { return this.byId.get(id); }
  all(): IterableIterator<NpcInstance> { return this.byId.values(); }
  // Saca un NPC del mundo (para /eliminarnpc). Devuelve la instancia borrada.
  remove(id: number): NpcInstance | undefined {
    const npc = this.byId.get(id);
    if (npc) this.byId.delete(id);
    return npc;
  }

  inMap(mapId: number): NpcInstance[] {
    const out: NpcInstance[] = [];
    for (const n of this.byId.values()) {
      if (n.mapId === mapId) out.push(n);
    }
    return out;
  }

  // Spawnea un NPC/criatura en runtime cerca de `at` (para el comando GM de
  // invocar). Devuelve la instancia, o null si el número no existe en NPCs.dat.
  spawnAt(npcNumber: number, mapId: number, at: Vector2, gmSpawned = false): NpcInstance | null {
    const type = getNpcType(npcNumber);
    if (!type) return null;
    const pos = findWalkableNear(mapId, at, type.waterOnly);
    const id = this.nextId++;
    const inst: NpcInstance = {
      id, type, mapId,
      spawn: { x: pos.x, y: pos.y },
      position: { x: pos.x, y: pos.y },
      direction: "south",
      hp: type.maxHp,
      deadUntil: 0,
      paralyzedUntil: 0,
      lastMoveAt: 0,
      lastAttackAt: 0,
      targetCharacterId: null,
      ownerCharacterId: null,
      petTargetNpcId: null,
      gmSpawned,
    };
    this.byId.set(id, inst);
    return inst;
  }
}

export const npcs = new NpcRegistry();

// Mascotas de un personaje (MascotasIndex del AO — máx. 3).
export const MAX_MASCOTAS = 3;
export function petsOf(characterId: number): NpcInstance[] {
  const out: NpcInstance[] = [];
  for (const n of npcs.all()) {
    if (n.ownerCharacterId === characterId && n.deadUntil === 0) out.push(n);
  }
  return out;
}

export function rollNpcDamage(type: NpcType, rng: () => number = Math.random): number {
  const span = type.damageMax - type.damageMin + 1;
  return type.damageMin + Math.floor(rng() * span);
}

// Oro por GiveGLD del AO: monto FIJO (NPCTirarOro no aleatoriza). goldMin==goldMax
// hoy, así que devuelve exactamente GiveGLD; se conserva el parámetro rng por
// compatibilidad de firma. La mayoría de las criaturas tiene GiveGLD=0 y su oro
// sale de la tabla de drops (item 12).
export function rollNpcGold(type: NpcType, _rng: () => number = Math.random): number {
  void _rng;
  return Math.max(0, type.goldMax);
}

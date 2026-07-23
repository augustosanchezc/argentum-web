// Catálogo de items del AO: los 1237 objetos reales de obj.dat (AO Libre).
// El catálogo vive en items.generated.ts — lo produce
// packages/server/scripts/parse-ao-dat.mjs a partir de Dat/obj.dat.

export type ItemType =
  | "weapon"
  | "armor"
  | "helmet"
  | "shield"
  | "potion"
  | "food"
  | "drink"
  | "arrow"
  | "misc";

export interface ItemDef {
  readonly id: number;
  readonly name: string;
  readonly type: ItemType;
  // ObjType crudo del AO (4 árbol · 22 yacimiento · 27 yunque · 28 fragua ·
  // 15 fogata · 6 puerta · 8 cartel · 36 árbol élfico ...)
  readonly objType: number;
  readonly value: number;
  // GrhIndex del AO (graficos.json / Graficos.ind)
  readonly graphic: number;
  // Arma / flecha: rango de daño real del obj.dat
  readonly minHit?: number;
  readonly maxHit?: number;
  readonly damageBonus?: number;
  // Arma: Apunala=1 (permite apuñalar), Proyectil=1 (arco/arrojadiza),
  // Municion=1 (consume flechas del inventario)
  readonly stabs?: boolean;
  readonly ranged?: boolean;
  readonly needsAmmo?: boolean;
  // Báculo: bonus de daño mágico del AO (dano × (StaffDamageBonus+70)/100).
  readonly staffDamageBonus?: number;
  // Casco/anillo antimagia: resta RandomNumber(min,max) al daño de hechizo recibido.
  readonly magicDefMin?: number;
  readonly magicDefMax?: number;
  // Armadura / casco / escudo: defensa que reduce daño recibido. En el AO se
  // tira RandomNumber(MinDef, MaxDef) en cada golpe; `defense` es el promedio
  // (para mostrar/back-compat), min/max son el rango real de obj.dat.
  readonly defense?: number;
  readonly defenseMin?: number;
  readonly defenseMax?: number;
  // Atributos ADICIONALES editables desde el panel admin (house rule): cualquier
  // item equipable puede otorgar, además de su stat base, HP máximo y/o ataque
  // extra mientras está equipado. Se suman entre todas las piezas equipadas.
  readonly bonusHp?: number;
  // Ataque extra. `bonusHit` aplica a AMBOS (jugadores y criaturas); `bonusHitPvp`
  // suma SOLO contra jugadores y `bonusHitNpc` SOLO contra criaturas. El bonus
  // efectivo vs jugadores = bonusHit + bonusHitPvp; vs criaturas = bonusHit + bonusHitNpc.
  readonly bonusHit?: number;
  readonly bonusHitPvp?: number;
  readonly bonusHitNpc?: number;
  // Armadura: NumRopaje — body de Personajes.ini que muestra el personaje
  // al equiparla (sistema de ropaje del AO).
  readonly bodyId?: number;
  // Poción: HP / MP que restaura. El AO tira RandomNumber(MinMod, MaxMod);
  // `heal` = promedio, healMin/Max = rango real. La poción azul (maná) NO usa
  // modificador: aplica una fórmula propia → `restoresMana` la marca.
  readonly heal?: number;
  readonly healMin?: number;
  readonly healMax?: number;
  readonly restoresMana?: boolean;
  readonly manaHeal?: number;
  readonly curesPoison?: boolean;
  // Drogas del AO: Poción Amarilla (+AGI) y Verde (+STR), con duración. El bonus
  // real es RandomNumber(Min, Max); *Boost = promedio, min/max = rango.
  readonly agiBoost?: number;
  readonly agiBoostMin?: number;
  readonly agiBoostMax?: number;
  readonly strBoost?: number;
  readonly strBoostMin?: number;
  readonly strBoostMax?: number;
  readonly boostSeconds?: number;
  // Comida / bebida: cuánto HAM / SED restaura (MinHAM de comida, MinAgu de
  // bebida en obj.dat). Las bebidas además dan energía (MinST → stamina).
  readonly hunger?: number;
  readonly thirst?: number;
  readonly stamina?: number;
  // Item de newbie (intransferible en el AO original)
  readonly newbie?: boolean;
  // Clases que NO pueden equipar este item (CP1..CPn de obj.dat, mapeadas a las
  // 6 clases del port: 1 Guerrero · 2 Mago · 3 Clérigo · 4 Cazador · 5 Asesino ·
  // 6 Druida). Se valida al equipar en handleUseItem.
  readonly forbiddenClasses?: readonly number[];
  // Herrería: skill mínima y lingotes (hierro/plata/oro) para construirlo
  readonly skHerreria?: number;
  readonly lingH?: number;
  readonly lingP?: number;
  readonly lingO?: number;
  // Carpintería: madera necesaria y skill mínima
  readonly madera?: number;
  readonly skCarpinteria?: number;
  // Yacimientos: item de mineral que producen al minarlos
  readonly mineralIndex?: number;
  // Barcos: skill de Navegación mínima (el body va en bodyId)
  readonly minSkillNav?: number;
  // Arma/escudo/casco: índice de animación de overlay (Armas.dat /
  // Escudos.dat / Cascos.ini del cliente AO).
  readonly anim?: number;
  // Carteles (objType 8): texto que muestran al interactuar.
  readonly texto?: string;
  // Pergaminos (objType 24): hechizo que enseñan (HechizoIndex de obj.dat →
  // id en AO_SPELLS). Al hacer doble-click el personaje lo aprende.
  readonly spellId?: number;
  // Ropa/armadura solo para MUJERES (Mujer=1 en obj.dat). Sin el flag = varón/
  // unisex. Se usa para filtrar en el panel admin al armar vendedores.
  readonly mujer?: boolean;
  // Puertas (objType 6): estado y contrapartes abierta/cerrada + llave.
  readonly cerrada?: boolean;
  readonly llave?: number;
  readonly indexAbierta?: number;
  readonly indexCerrada?: number;
}

// Agua del AO clásico (rangos de GRH de agua) — compartido entre el server
// (movimiento/pesca) y el cliente (predicción).
export function isWaterGraphic(g: number): boolean {
  return (g >= 1505 && g <= 1520) || (g >= 5665 && g <= 5680) || (g >= 13547 && g <= 13562);
}

export { ITEMS } from "./items.generated.js";
import { ITEMS as _ITEMS } from "./items.generated.js";

// ── Overrides editables (panel de administración) ─────────────────────────
// El catálogo base (items.generated) es el balance original de AO Libre y NO
// se toca. El admin puede sobreescribir campos por id; getItem() mergea el
// override sobre la base. En el server los overrides se cargan de un JSON; en
// el cliente se piden al server al arrancar (GET /item-overrides). Así el
// balance original queda intacto y los cambios son reversibles.
const _itemOverrides = new Map<number, Partial<ItemDef>>();

export function getItem(id: number): ItemDef | undefined {
  const base = _ITEMS[id];
  if (!base) return undefined;
  const ov = _itemOverrides.get(id);
  return ov ? { ...base, ...ov } : base;
}

// Reemplaza todos los overrides (al arrancar el server o el cliente).
export function loadItemOverrides(obj: Record<string, Partial<ItemDef>>): void {
  _itemOverrides.clear();
  for (const [k, v] of Object.entries(obj)) _itemOverrides.set(Number(k), v);
}

// Aplica/mergea un override sobre un item (al editar desde el panel).
export function setItemOverride(id: number, patch: Partial<ItemDef>): void {
  _itemOverrides.set(id, { ...(_itemOverrides.get(id) ?? {}), ...patch });
}

export function getItemOverrides(): Record<string, Partial<ItemDef>> {
  const out: Record<string, Partial<ItemDef>> = {};
  for (const [k, v] of _itemOverrides) out[k.toString()] = v;
  return out;
}

// Una posición de inventario: un item y su cantidad (para apilables como pociones).
export interface InventorySlot {
  readonly item: number;
  readonly qty: number;
}

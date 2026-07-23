// Genera packages/shared/src/items.custom.ts: 140 armaduras faccionarias por
// rango (7 clases × 2 facciones × 2 variantes de raza × 5 jerarquías), clonando
// el graphic/bodyId de la armadura "de 2da Jerarquía" de cada set y escalando la
// defensa. Cada item requiere facción + rango para equiparse y no se cae al morir.
// Uso: tsx packages/server/scripts/gen-faction-armors.mts
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ITEMS } from "../../shared/src/items.generated.ts";
import type { ItemDef } from "../../shared/src/items.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../shared/src/items.custom.ts");

// class, [ArmadaAlto, ArmadaEG], [CaosAlto, CaosEG]
const SETS: Array<{ cls: number; name: string; armada: [number, number]; caos: [number, number] }> = [
  { cls: 1, name: "Guerrero", armada: [1093, 1094], caos: [1095, 1096] },
  { cls: 2, name: "Mago", armada: [1101, 1102], caos: [1103, 1104] },
  { cls: 3, name: "Clérigo", armada: [1085, 1086], caos: [1087, 1088] },
  { cls: 4, name: "Cazador", armada: [1081, 1082], caos: [1083, 1084] },
  { cls: 5, name: "Asesino", armada: [1069, 1070], caos: [1071, 1072] },
  { cls: 6, name: "Druida", armada: [1089, 1090], caos: [1091, 1092] },
  { cls: 7, name: "Paladín", armada: [1105, 1106], caos: [1107, 1108] },
];

// Curva de defensa base por jerarquía (1..5). Tuneable después desde el panel.
const DEF_CURVE = [10, 18, 26, 34, 42];
const JER_NAME = ["1ra", "2da", "3ra", "4ta", "5ta"];
const FACTION_NAME: Record<number, string> = { 1: "Armada", 2: "Caos" };

let nextId = 2000;
const items: ItemDef[] = [];
// lookup[faction][classId][variant] = [id j1..j5]
const lookup: Record<number, Record<number, { alto: number[]; eg: number[] }>> = { 1: {}, 2: {} };

function makeSet(faction: number, cls: number, clsName: string, baseAltoId: number, baseEgId: number): void {
  lookup[faction]![cls] = { alto: [], eg: [] };
  for (const [variant, baseId, egSuffix] of [
    ["alto", baseAltoId, ""],
    ["eg", baseEgId, " (E/G)"],
  ] as const) {
    const base = ITEMS[baseId];
    if (!base) throw new Error(`falta item base ${baseId}`);
    for (let jer = 1; jer <= 5; jer++) {
      const id = nextId++;
      const def = DEF_CURVE[jer - 1]!;
      items.push({
        id,
        name: `Armadura de ${clsName} de ${JER_NAME[jer - 1]} Jerarquía (${FACTION_NAME[faction]})${egSuffix}`,
        type: "armor",
        objType: 3,
        value: 0,
        graphic: base.graphic,
        defense: def,
        defenseMin: def,
        defenseMax: def,
        ...(base.bodyId !== undefined ? { bodyId: base.bodyId } : {}),
        ...(base.forbiddenClasses ? { forbiddenClasses: [...base.forbiddenClasses] } : {}),
        factionReq: faction,
        factionRankReq: jer,
      });
      lookup[faction]![cls]![variant].push(id);
    }
  }
}

for (const s of SETS) {
  makeSet(1, s.cls, s.name, s.armada[0], s.armada[1]);
  makeSet(2, s.cls, s.name, s.caos[0], s.caos[1]);
}

// ── Serializar a TS ──────────────────────────────────────────────────────
const itemLines = items
  .map((it) => {
    const parts = Object.entries(it).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    return `  ${it.id}: { ${parts.join(", ")} },`;
  })
  .join("\n");

const out = `// AUTO-GENERADO por packages/server/scripts/gen-faction-armors.mts — NO EDITAR A MANO.
// Armaduras faccionarias por rango (jerarquía): clonan el graphic/bodyId de las
// armaduras "de 2da Jerarquía", con defensa escalada por jerarquía. Requieren
// facción + rango para equiparse (factionReq/factionRankReq) y no se caen al morir.
import type { ItemDef } from "./items.js";

export const CUSTOM_ITEMS: Record<number, ItemDef> = {
${itemLines}
};

// Lookup de recompensa: por facción (1 Armada · 2 Caos) → clase → variante de
// raza (alto = Humano/Elfo/Elfo Oscuro · eg = Gnomo/Enano) → [id jer1..jer5].
export const FACTION_RANK_ARMOR: Record<number, Record<number, { alto: number[]; eg: number[] }>> =
${JSON.stringify(lookup, null, 2)};
`;

writeFileSync(OUT, out);
console.log(`✓ items.custom.ts: ${items.length} armaduras faccionarias (ids ${items[0]!.id}–${items[items.length - 1]!.id})`);

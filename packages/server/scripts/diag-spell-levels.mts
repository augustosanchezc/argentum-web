// Cuadro: minSkill (Magia) de cada hechizo en AO Libre y a qué nivel se
// habilita, comparando el cap de skill de AO Libre vs la curva de nuestro
// server (skillsForLevel, cóncava 100@34).
// Uso: tsx packages/server/scripts/diag-spell-levels.mts
import { AO_SPELLS } from "../../shared/src/spells.generated.ts";
import { ITEMS } from "../../shared/src/items.generated.ts";
import { skillsForLevel, levelSkillCap } from "../../shared/src/skills-uso.ts";
import { CLASS_SPELLBOOK } from "../../shared/src/spellbook.ts";

const CLASS_NAMES: Record<number, string> = {
  1: "Guerrero", 2: "Mago", 3: "Clérigo", 4: "Arquero", 5: "Asesino", 6: "Druida", 7: "Paladín",
};
const MAGIC_CLASSES = [2, 3, 6, 7]; // clases con libro de magia (classUsesMagic)

// Nivel AO Libre: primer nivel cuyo cap de skill permite alcanzar el minSkill.
function aoLibreLevel(minSkill: number): number | null {
  for (let lvl = 1; lvl <= 45; lvl++) if (levelSkillCap(lvl) >= minSkill) return lvl;
  return null;
}
// Nivel en NUESTRO server: primer nivel cuya Magia (curva cóncava) alcanza minSkill.
function ourLevel(minSkill: number): number | null {
  for (let lvl = 1; lvl <= 34; lvl++) if (skillsForLevel(lvl).magia >= minSkill) return lvl;
  return null;
}

// Pergaminos existentes (objType 24) → spellId + clases prohibidas.
const scrollBySpell = new Map<number, { forbidden: number[] }>();
for (const it of Object.values(ITEMS)) {
  if (it.objType === 24 && it.spellId !== undefined) {
    scrollBySpell.set(it.spellId, { forbidden: [...(it.forbiddenClasses ?? [])] });
  }
}

// Curva de Magia por nivel (referencia).
console.log("=== Curva de Magia por NIVEL ===");
console.log("AO Libre (cap): nv1→3 · nv4→10 · nv8→20 · nv12→30 · nv20→50 · nv32→80 · nv40→100");
const sample = [1, 4, 8, 12, 20, 27, 34];
console.log("Nuestro server:", sample.map((l) => `nv${l}→${skillsForLevel(l).magia}`).join(" · "));

console.log("\n=== CUADRO DE HECHIZOS ===");
const header = ["ID", "Hechizo", "minSkill", "nivelAO", "nivelServer", "clasesQueAprenden"];
console.log(header.join(" | "));
console.log(header.map(() => "---").join(" | "));

const rows = Object.values(AO_SPELLS).sort((a, b) => a.minSkill - b.minSkill || a.id - b.id);
for (const sp of rows) {
  const scroll = scrollBySpell.get(sp.id);
  // Clases que PUEDEN aprenderlo: mágicas no prohibidas por el pergamino.
  const learnable = scroll
    ? MAGIC_CLASSES.filter((c) => !scroll.forbidden.includes(c)).map((c) => CLASS_NAMES[c])
    : [];
  const clasesStr = !scroll ? "(sin pergamino)" : learnable.length ? learnable.join(",") : "(ninguna)";
  console.log([
    sp.id,
    sp.name,
    sp.minSkill,
    aoLibreLevel(sp.minSkill) ?? "—",
    ourLevel(sp.minSkill) ?? "—(>100)",
    clasesStr,
  ].join(" | "));
}

// Comparación con el CLASS_SPELLBOOK actual (los minLevel hardcodeados).
console.log("\n=== DISCREPANCIAS: CLASS_SPELLBOOK (minLevel actual) vs nivelServer (por minSkill) ===");
for (const [classId, book] of Object.entries(CLASS_SPELLBOOK)) {
  for (const e of book) {
    const sp = AO_SPELLS[e.spellId];
    if (!sp) continue;
    const derived = ourLevel(sp.minSkill);
    if (derived !== e.minLevel) {
      console.log(`  ${CLASS_NAMES[+classId]} · ${sp.name}: libro=nv${e.minLevel} vs derivado(minSkill ${sp.minSkill})=nv${derived}`);
    }
  }
}

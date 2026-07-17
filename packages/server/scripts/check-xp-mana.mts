import { getClass, calcMaxMp } from "@ao/shared";
import { cumulativeXpForLevel } from "../src/world/xp.js";
console.log("== XP acumulada para alcanzar nivel ==");
for (const lv of [2, 5, 10, 20, 30, 40, 50]) {
  console.log(`  Nv ${String(lv).padStart(2)}: ${cumulativeXpForLevel(lv).toLocaleString("es")}`);
}
console.log("\n== Maná máx (INT 24) ==");
for (const cid of [2, 3, 6, 5]) {
  const c = getClass(cid)!;
  const vals = [1, 10, 25, 50].map((lv) => `Nv${lv}:${calcMaxMp(c, lv, 24)}`).join("  ");
  console.log(`  ${c.name.padEnd(9)} (manaK ${c.manaK})  ${vals}`);
}
process.exit(0);

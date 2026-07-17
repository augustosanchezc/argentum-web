import { getClass, calcMaxHp, golpeUsuario } from "@ao/shared";
for (const [cid, con] of [[1, 20], [2, 20], [4, 20]] as const) {
  const cls = getClass(cid)!;
  console.log(`\n== ${cls.name} (CON ${con}, modVida ${cls.modVida}, hit ${cls.hitPerLevel}/${cls.hitPerLevelOver35}) ==`);
  for (const lv of [1, 10, 20, 34, 35, 36, 40, 50]) {
    const g = golpeUsuario(cid, lv);
    console.log(`  Nv ${String(lv).padStart(2)}  HP ${String(calcMaxHp(cls, lv, con)).padStart(4)}   golpe ${g.min}-${g.max}`);
  }
}
process.exit(0);

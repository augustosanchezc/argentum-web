import { CLASSES, calcMaxHp, calcMaxMp, getClass, STAT_POINTS_PER_LEVEL } from "@ao/shared";

export { CLASSES, calcMaxHp, calcMaxMp, getClass, STAT_POINTS_PER_LEVEL };

export interface InitialStats {
  classId: number;
  str: number;
  agi: number;
  int_: number;
  con: number;
  car: number;
  maxHp: number;
  maxMana: number;
  bodyId: number;
  headId: number;
}

export function calcInitialStats(classId: number): InitialStats {
  const def = CLASSES[classId] ?? CLASSES[1];
  return {
    classId: def.id,
    str: def.str,
    agi: def.agi,
    int_: def.int,
    con: def.con,
    car: def.car,
    maxHp: calcMaxHp(def, 1, def.con),
    maxMana: calcMaxMp(def, 1, def.int),
    bodyId: def.startBodyId,
    headId: def.startHeadId,
  };
}

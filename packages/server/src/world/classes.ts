import { CLASSES, calcMaxHp, calcMaxMp, calcMaxSta, getClass, golpeUsuario, STAT_POINTS_PER_LEVEL, RACES, raceAttributes } from "@ao/shared";

export { CLASSES, calcMaxHp, calcMaxMp, calcMaxSta, getClass, golpeUsuario, STAT_POINTS_PER_LEVEL };

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

// Stats iniciales según RAZA + género + cabeza elegida. En el AO los atributos
// dependen de la raza (base 18 + MODRAZA); la clase define vida/maná y rol. El
// cuerpo es el desnudo por raza+género (la armadura equipada lo cambia por su
// ropaje in-game). La cabeza es la elegida (validada en el rango de la raza).
export function calcInitialStatsRaced(
  classId: number,
  race: number,
  gender: number,
  head: number,
): InitialStats {
  const def = CLASSES[classId] ?? CLASSES[1];
  const raceDef = RACES[race] ?? RACES[1]!;
  const a = raceAttributes(race);
  return {
    classId: def.id,
    str: a.str,
    agi: a.agi,
    int_: a.int,
    con: a.con,
    car: a.car,
    maxHp: calcMaxHp(def, 1, a.con),
    maxMana: calcMaxMp(def, 1, a.int),
    bodyId: gender === 2 ? raceDef.body[2] : raceDef.body[1],
    headId: head,
  };
}

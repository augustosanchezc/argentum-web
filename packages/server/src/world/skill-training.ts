// Skills en este server: se determinan por NIVEL (skillsForLevel de @ao/shared:
// las 21 skills llegan a 100 al nivel 34), decisión de diseño del port. NO se
// entrenan por uso.
//
// `trainSkill` es un NO-OP intencional. Antes subía skills por uso (SubirSkill
// del AO), pero como el login y cada subida de nivel reescriben `s.skills` con
// `skillsForLevel(level)`, ese entrenamiento creaba una inconsistencia: las
// skills subían durante la sesión y se "reseteaban" al reloguear o subir de
// nivel. Se conserva la firma (la llaman ~20 sitios de combate/trabajo) pero ya
// no muta nada, para que las skills sean puramente función del nivel.

import type { SkillKey } from "@ao/shared";
import type { Session } from "../ws/sessions.js";

export interface TrainResult {
  leveled: boolean;
  newValue: number;
}

export function trainSkill(s: Session, skill: SkillKey, _success: boolean): TrainResult {
  void _success;
  return { leveled: false, newValue: s.skills[skill] };
}

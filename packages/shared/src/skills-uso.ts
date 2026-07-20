// Skills por uso del AO original (SubirSkill de Modulo_UsUaRiOs.bas):
// suben usándolas — +50 XP por acierto, +20 por fallo — con tope por nivel
// (LevelSkill de General.bas) y máximo absoluto 100 (MAXSKILLPOINTS).

export type SkillKey =
  | "magia"
  | "robar"
  | "tacticas"
  | "armas"
  | "meditar"
  | "apunalar"
  | "ocultarse"
  | "supervivencia"
  | "talar"
  | "comerciar"
  | "defensa"
  | "pesca"
  | "mineria"
  | "carpinteria"
  | "herreria"
  | "liderazgo"
  | "domar"
  | "proyectiles"
  | "wrestling"
  | "navegacion"
  | "equitacion";

export const SKILL_NAMES: Record<SkillKey, string> = {
  magia: "Magia",
  robar: "Robar",
  tacticas: "Tácticas de combate",
  armas: "Combate con armas",
  meditar: "Meditar",
  apunalar: "Apuñalar",
  ocultarse: "Ocultarse",
  supervivencia: "Supervivencia",
  talar: "Talar",
  comerciar: "Comerciar",
  defensa: "Defensa con escudos",
  pesca: "Pesca",
  mineria: "Minería",
  carpinteria: "Carpintería",
  herreria: "Herrería",
  liderazgo: "Liderazgo",
  domar: "Domar animales",
  proyectiles: "Armas de proyectiles",
  wrestling: "Combate sin armas",
  navegacion: "Navegación",
  equitacion: "Equitación",
};

export type SkillSet = Record<SkillKey, number>;

export function emptySkills(): SkillSet {
  const out = {} as SkillSet;
  for (const k of Object.keys(SKILL_NAMES) as SkillKey[]) out[k] = 0;
  return out;
}

// Tope de skill por nivel (LevelSkill, General.bas L425):
// nv1→3, nv4→10, nv8→20, nv12→30, nv20→50, nv32→80, nv40+→100.
export function levelSkillCap(level: number): number {
  if (level >= 40) return 100;
  if (level >= 32) return 80;
  if (level >= 20) return 50;
  if (level >= 12) return 30;
  if (level >= 8) return 20;
  if (level >= 4) return 10;
  return 3;
}

export const MAX_SKILL = 100;
// XP de skill por uso (EXP_ACIERTO_SKILL / EXP_FALLO_SKILL del AO).
export const SKILL_XP_SUCCESS = 50;
export const SKILL_XP_FAIL = 20;

// XP necesaria para subir 1 punto desde el valor actual. La tabla ELU exacta
// del original vive fuera de los .bas extraídos — progresión creciente
// aproximada y documentada: cuesta más subir cuanto más alto el skill.
export function skillXpToNext(current: number): number {
  return 50 * (current + 1);
}

// Skills iniciales por clase: los 10 puntos de la creación del AO,
// asignados de forma óptima fija (misma decisión que los atributos).
export const INITIAL_SKILLS: Record<number, Partial<SkillSet>> = {
  1: { armas: 10 },                 // Guerrero
  2: { magia: 10 },                 // Mago
  3: { magia: 5, armas: 5 },        // Clérigo
  4: { proyectiles: 10 },           // Arquero
  5: { apunalar: 5, armas: 5 },     // Asesino
  6: { magia: 10 },                 // Druida
  7: { armas: 7, magia: 3 },        // Paladín (guerrero sagrado híbrido)
};

export function initialSkillsFor(classId: number): SkillSet {
  const out = emptySkills();
  const extra = INITIAL_SKILLS[classId] ?? {};
  for (const [k, v] of Object.entries(extra)) out[k as SkillKey] = v;
  return out;
}

// Nivel al que todas las skills llegan a 100.
export const SKILL_MAX_LEVEL = 34;

// Skills escaladas por NIVEL: en este server las 21 skills suben junto con el
// nivel (no por uso). Curva CÓNCAVA (raíz cuadrada): llega a 100 en el nivel 34
// (SKILL_MAX_LEVEL) pero sube RÁPIDO al principio, para que entrenar los
// primeros ~25 niveles no sea tan duro (antes era lineal y dejaba el golpe muy
// bajo hasta media partida). Aplica igual a TODAS las clases; cada una conserva
// sus propios números (modAtaque, golpe por nivel, agilidad) en las fórmulas de
// combate. Ej: nivel 5 pasa de skill 15 a 38; nivel 17 de 50 a 71.
export function skillsForLevel(level: number): SkillSet {
  const t = Math.max(0, Math.min(1, level / SKILL_MAX_LEVEL));
  const v = Math.round(100 * Math.sqrt(t));
  const out = {} as SkillSet;
  for (const k of Object.keys(SKILL_NAMES) as SkillKey[]) out[k] = v;
  return out;
}

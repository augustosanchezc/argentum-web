// Habilidades de clase del AO web. Una habilidad primaria por clase.
// El sistema es extensible: agregar más skills con IDs > 10.

export type SkillType = "damage" | "heal" | "dot" | "buff";

export interface SkillDef {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly classId: number;     // qué clase puede usarla
  readonly mpCost: number;
  readonly cooldownMs: number;
  readonly range: number;       // tiles (1 = cuerpo a cuerpo, 0 = self)
  readonly type: SkillType;
  readonly key: string;         // tecla de acceso rápido sugerida
  // Para daño mágico: multiplicador sobre INT del personaje
  readonly intMultiplier?: number;
  // Para daño físico: multiplicador sobre el daño normal
  readonly dmgMultiplier?: number;
  // Para DoT: daño por tick y cantidad de ticks (1s cada uno)
  readonly dotDamage?: number;
  readonly dotTicks?: number;
}

export const SKILLS: Record<number, SkillDef> = {
  // Guerrero: golpe que duplica el daño (sin costo de MP)
  1: {
    id: 1, name: "Golpe especial", classId: 1, key: "1",
    description: "Golpe poderoso que duplica el daño durante un ataque.",
    mpCost: 0, cooldownMs: 10_000, range: 1,
    type: "damage", dmgMultiplier: 2,
  },
  // Mago: rayo eléctrico (daño mágico basado en INT, rango 10)
  2: {
    id: 2, name: "Rayo eléctrico", classId: 2, key: "1",
    description: "Lanza un rayo de energía arcana que ignora armadura.",
    mpCost: 15, cooldownMs: 1_500, range: 10,
    type: "damage", intMultiplier: 0.8,
  },
  // Clérigo: cura a un aliado en rango (incluyendo a sí mismo)
  3: {
    id: 3, name: "Curar", classId: 3, key: "1",
    description: "Restaura HP de un aliado en rango. Basado en INT.",
    mpCost: 20, cooldownMs: 3_000, range: 5,
    type: "heal", intMultiplier: 1.0,
  },
  // Arquero: disparo a distancia (sin costo de MP, CD corto)
  4: {
    id: 4, name: "Disparo", classId: 4, key: "1",
    description: "Disparo con arco preciso a larga distancia.",
    mpCost: 0, cooldownMs: 1_200, range: 8,
    type: "damage", dmgMultiplier: 1.2,
  },
  // Asesino: golpe crítico garantizado
  5: {
    id: 5, name: "Golpe certero", classId: 5, key: "1",
    description: "Golpe preciso que siempre impacta y aplica el máximo daño.",
    mpCost: 5, cooldownMs: 5_000, range: 1,
    type: "damage", dmgMultiplier: 1.8,
  },
  // Druida: veneno (DoT 5 ticks × 5 HP)
  6: {
    id: 6, name: "Veneno", classId: 6, key: "1",
    description: "Envenena al objetivo: 5 de daño por segundo durante 5 segundos.",
    mpCost: 12, cooldownMs: 8_000, range: 6,
    type: "dot", dotDamage: 5, dotTicks: 5,
  },
};

export function getSkill(id: number): SkillDef | undefined {
  return SKILLS[id];
}

export function getClassSkill(classId: number): SkillDef | undefined {
  return Object.values(SKILLS).find((s) => s.classId === classId);
}

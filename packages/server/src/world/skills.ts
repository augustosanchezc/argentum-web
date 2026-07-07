import { getSkill } from "@ao/shared";
import type { Session } from "../ws/sessions.js";

export interface SkillResult {
  ok: boolean;
  reason?: string;
  amount?: number;
  newTargetHp?: number;
  newTargetMaxHp?: number;
  dotApplied?: boolean;
  newCasterMana: number;
}

// DoTs activos: targetCharacterId → lista de efectos pendientes
export const activeDots = new Map<
  number,
  { damage: number; ticksLeft: number; casterId: number }[]
>();

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function executeSkill(
  caster: Session,
  target: Session | null,
  skillId: number,
  rng: () => number = Math.random,
): SkillResult {
  const def = getSkill(skillId);
  if (!def) return { ok: false, reason: "UNKNOWN_SKILL", newCasterMana: caster.mana };

  if (caster.deadUntil !== 0) return { ok: false, reason: "DEAD", newCasterMana: caster.mana };
  if (caster.mana < def.mpCost) return { ok: false, reason: "NO_MANA", newCasterMana: caster.mana };

  const now = Date.now();
  if (now - caster.lastSkillAt < def.cooldownMs) {
    return { ok: false, reason: "COOLDOWN", newCasterMana: caster.mana };
  }

  // Skills con objetivo requieren target en rango
  if (def.type !== "buff" && def.range > 0 && target) {
    const dist = manhattan(caster.position, target.position);
    if (dist > def.range) return { ok: false, reason: "OUT_OF_RANGE", newCasterMana: caster.mana };
  }

  // Descontar MP y registrar cooldown
  caster.mana = Math.max(0, caster.mana - def.mpCost);
  caster.lastSkillAt = now;

  const newCasterMana = caster.mana;

  if (def.type === "damage") {
    if (!target) return { ok: false, reason: "NO_TARGET", newCasterMana };

    let amount: number;
    if (def.intMultiplier !== undefined) {
      // Daño mágico: basado en INT, ignora armadura
      amount = Math.max(1, Math.floor(caster.int_ * def.intMultiplier * (1 + caster.level * 0.05)));
    } else {
      // Daño físico: basado en arma y STR
      const dmgMult = def.dmgMultiplier ?? 1;
      const base = caster.weaponBonus * dmgMult + Math.floor(caster.str / 4);
      amount = Math.max(1, Math.floor(base + Math.floor(rng() * caster.level)));
    }

    const newHp = Math.max(0, target.hp - amount);
    target.hp = newHp;
    return { ok: true, amount, newTargetHp: newHp, newTargetMaxHp: target.maxHp, newCasterMana };
  }

  if (def.type === "heal") {
    const healTarget = target ?? caster;
    const amount = Math.max(5, Math.floor((def.intMultiplier ?? 1) * caster.int_ + caster.level * 2));
    const newHp = Math.min(healTarget.maxHp, healTarget.hp + amount);
    healTarget.hp = newHp;
    return { ok: true, amount, newTargetHp: newHp, newTargetMaxHp: healTarget.maxHp, newCasterMana };
  }

  if (def.type === "dot") {
    if (!target) return { ok: false, reason: "NO_TARGET", newCasterMana };
    const dotDmg = def.dotDamage ?? 5;
    const dotTicks = def.dotTicks ?? 5;
    const existing = activeDots.get(target.characterId) ?? [];
    existing.push({ damage: dotDmg, ticksLeft: dotTicks, casterId: caster.characterId });
    activeDots.set(target.characterId, existing);
    return { ok: true, dotApplied: true, newCasterMana };
  }

  return { ok: true, newCasterMana };
}

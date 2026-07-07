import { activeDots } from "./skills.js";
import { sessions } from "../ws/sessions.js";

export interface DotTickResult {
  targetId: number;
  damage: number;
  newHp: number;
  dead: boolean;
  casterId: number;
}

export function tickDots(): DotTickResult[] {
  const results: DotTickResult[] = [];

  for (const [targetCharId, dots] of activeDots.entries()) {
    const target = sessions.getByCharacterId(targetCharId);
    // Si el target no existe o está muerto, limpiar todos sus DoTs
    if (!target || target.deadUntil !== 0) {
      activeDots.delete(targetCharId);
      continue;
    }

    const remaining: { damage: number; ticksLeft: number; casterId: number }[] = [];
    for (const dot of dots) {
      const dmg = Math.max(1, dot.damage);
      target.hp = Math.max(0, target.hp - dmg);
      results.push({
        targetId: targetCharId,
        damage: dmg,
        newHp: target.hp,
        dead: target.hp === 0,
        casterId: dot.casterId,
      });

      const next = dot.ticksLeft - 1;
      if (next > 0) remaining.push({ ...dot, ticksLeft: next });
    }

    if (remaining.length > 0) {
      activeDots.set(targetCharId, remaining);
    } else {
      activeDots.delete(targetCharId);
    }
  }

  return results;
}

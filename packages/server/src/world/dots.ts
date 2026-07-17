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

    const remaining: { damage: number; ticksLeft: number; casterId: number; poison?: boolean }[] = [];
    for (const dot of dots) {
      // Veneno del AO: RandomNumber(1,5) por tick; el resto usa su daño fijo.
      const dmg = dot.poison ? 1 + Math.floor(Math.random() * 5) : Math.max(1, dot.damage);
      target.hp = Math.max(0, target.hp - dmg);
      results.push({
        targetId: targetCharId,
        damage: dmg,
        newHp: target.hp,
        dead: target.hp === 0,
        casterId: dot.casterId,
      });

      // El veneno persiste hasta curarse/morir; los DoTs de skill decrementan.
      if (dot.poison) {
        remaining.push({ ...dot });
      } else {
        const next = dot.ticksLeft - 1;
        if (next > 0) remaining.push({ ...dot, ticksLeft: next });
      }
    }

    if (remaining.length > 0) {
      activeDots.set(targetCharId, remaining);
    } else {
      activeDots.delete(targetCharId);
    }
  }

  return results;
}

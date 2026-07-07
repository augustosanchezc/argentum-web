import type { Session } from "../ws/sessions.js";
import { sessions } from "../ws/sessions.js";

export const REGEN_INTERVAL_MS = 5_000;

// Un tick de regen pasivo: HP +1, MP +2 para todos los jugadores vivos.
// sendFn debe construir y enviar el StatsUpdate al jugador correspondiente.
export function tickRegen(sendFn: (s: Session) => void): void {
  for (const s of sessions.all()) {
    if (s.deadUntil !== 0) continue;
    let changed = false;
    if (s.hp < s.maxHp) {
      s.hp = Math.min(s.maxHp, s.hp + 1);
      changed = true;
    }
    if (s.maxMana > 0 && s.mana < s.maxMana) {
      s.mana = Math.min(s.maxMana, s.mana + 2);
      changed = true;
    }
    if (changed) sendFn(s);
  }
}

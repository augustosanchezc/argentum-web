import type { Session } from "../ws/sessions.js";

// Criminal PERSISTENTE (como la reputación del AO): sos criminal mientras
// tengas ciudadanos matados sin perdonar. El perdón se compra con FIANZAS al
// sacerdote, con precio creciente por Fibonacci. La Legión Oscura (faction 2)
// es criminal por definición.
export function setCriminal(session: Session): void {
  // Derivado de citizensKilled > pardonedKills — nada que setear; queda por
  // compatibilidad con los call sites del combate.
  session.criminalUntil = Number.MAX_SAFE_INTEGER;
}

export function isCriminal(session: Session): boolean {
  return session.faction === 2 || session.citizensKilled > session.pardonedKills;
}

// Precio de la próxima fianza: 500 × Fibonacci(n). Arranca barato y escala:
// 500, 500, 1000, 1500, 2500, 4000, 6500…
export function bailPrice(bailsPaid: number): number {
  let a = 1;
  let b = 1;
  for (let i = 0; i < bailsPaid; i += 1) {
    const next = a + b;
    a = b;
    b = next;
  }
  return 500 * a;
}

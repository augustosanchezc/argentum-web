import type { Session } from "../ws/sessions.js";

export const CRIMINAL_DURATION_MS = 5 * 60 * 1000; // 5 minutos

export function setCriminal(session: Session): void {
  session.criminalUntil = Date.now() + CRIMINAL_DURATION_MS;
}

export function isCriminal(session: Session): boolean {
  return session.criminalUntil > Date.now();
}

export function clearExpiredCriminal(session: Session): void {
  if (session.criminalUntil > 0 && session.criminalUntil <= Date.now()) {
    session.criminalUntil = 0;
  }
}

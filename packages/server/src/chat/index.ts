import { CHAT_TEXT_MAX_LENGTH } from "@ao/shared";

// 1 mensaje por segundo es lo que usa el AO original. Para chat global
// alcanza; si quisieramos burst, podriamos sumar token bucket — por ahora
// cooldown duro.
export const CHAT_COOLDOWN_MS = 1_000;

// Caracteres de control ASCII (incluyendo \n y \t) — los quitamos porque
// chat es de una sola linea y no queremos VT/BEL/etc.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

export type ChatValidation =
  | { ok: true; text: string }
  | { ok: false; reason: "EMPTY" | "TOO_LONG" | "RATE_LIMITED" };

// Sanea y valida el texto. No persiste ni envia — eso lo hace el caller.
export function validateChatText(raw: unknown): ChatValidation {
  if (typeof raw !== "string") return { ok: false, reason: "EMPTY" };

  const cleaned = raw.replace(CONTROL_CHARS, "").trim();

  if (cleaned.length === 0) return { ok: false, reason: "EMPTY" };
  if (cleaned.length > CHAT_TEXT_MAX_LENGTH) {
    return { ok: false, reason: "TOO_LONG" };
  }

  return { ok: true, text: cleaned };
}

export function isOnChatCooldown(lastChatAt: number, now: number): boolean {
  return now - lastChatAt < CHAT_COOLDOWN_MS;
}

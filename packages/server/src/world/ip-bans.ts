// Baneos por IP (persistentes en el volumen, como los otros overrides). Un GM
// banea la IP de un jugador (/banip) y esa IP no puede volver a conectarse,
// aunque cree otra cuenta. Sobrevive a los redeploy.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const PATH = overridePath("ip-bans.json");
const banned = new Set<string>();

try {
  const text = readOverrideOrSeed("ip-bans.json");
  if (text) {
    const arr = JSON.parse(text) as string[];
    if (Array.isArray(arr)) for (const ip of arr) banned.add(ip);
  }
} catch {
  // sin baneos todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(PATH), { recursive: true });
    writeFileSync(PATH, JSON.stringify([...banned], null, 2));
  } catch {
    // disco de solo lectura
  }
}

export function isIpBanned(ip: string): boolean {
  return ip !== "" && banned.has(ip);
}

// IP pública baneable: NO loopback ni rangos privados. Guard anti-desastre: si
// por un proxy mal configurado la IP fuese la interna (172.x/10.x/127.x), banearla
// echaría a TODOS. En ese caso banIp se niega.
function isBannableIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip.startsWith("127.")) return false; // loopback
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return false;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false; // 172.16-31.x
  if (ip.startsWith("fc") || ip.startsWith("fd")) return false; // IPv6 privada (ULA)
  return true;
}

// Devuelve true si se agregó (false si no es baneable o ya estaba).
export function banIp(ip: string): boolean {
  if (!isBannableIp(ip) || banned.has(ip)) return false;
  banned.add(ip);
  persist();
  return true;
}

// Devuelve true si se quitó.
export function unbanIp(ip: string): boolean {
  if (!banned.delete(ip)) return false;
  persist();
  return true;
}

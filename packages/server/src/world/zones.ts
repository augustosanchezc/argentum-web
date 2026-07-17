// Sistema de zonas seguras del AO: las ciudades (Pk=1 en su MapaN.dat
// original — Ullathorpe, Nix, Banderbill, etc.) no permiten PvP.
// La verdad vive en MapState.safeZone, cargada de los .dat reales.

import { getMap } from "./maps.js";

export function isSafeZone(mapId: number): boolean {
  return getMap(mapId)?.safeZone ?? false;
}

// Devuelve true si el atacante puede atacar al defensor.
// En zona segura, los jugadores no se pueden atacar entre sí.
export function canAttackPlayer(attackerMapId: number, defenderMapId: number): boolean {
  if (isSafeZone(attackerMapId) || isSafeZone(defenderMapId)) return false;
  return true;
}

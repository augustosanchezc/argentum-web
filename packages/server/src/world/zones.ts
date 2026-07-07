// Sistema de zonas seguras (AO-like).
// Mapa 1 = Ullathorpe = ciudad = sin PvP.

export function isSafeZone(mapId: number): boolean {
  return mapId === 1;
}

// Devuelve true si el atacante puede atacar al defensor.
// En zona segura, los jugadores no se pueden atacar entre sí.
export function canAttackPlayer(attackerMapId: number, defenderMapId: number): boolean {
  if (isSafeZone(attackerMapId) || isSafeZone(defenderMapId)) return false;
  return true;
}

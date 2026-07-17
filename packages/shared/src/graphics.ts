// La renderización de personajes usa los datos reales del AO Libre:
//   - packages/client/public/ao-assets/graficos.json   → GRH ID → PNG + coords
//   - packages/client/public/ao-assets/personajes.json → bodyId/headId → GRH frames
//
// Generados por: node packages/client/scripts/parse-ao-assets.mjs
// Fuentes: Graficos.ind + Personajes.ini + Cabezas.ind del AO Libre original.
//
// Este archivo mantiene solo tipos que pueden ser útiles en el shared layer.

export type AnimDirection = "north" | "south" | "east" | "west";

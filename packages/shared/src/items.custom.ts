// AUTO-GENERADO por packages/server/scripts/gen-faction-armors.mts — NO EDITAR A MANO.
// Armaduras faccionarias por rango (jerarquía): clonan el graphic/bodyId de las
// armaduras "de 2da Jerarquía", con defensa escalada por jerarquía. Requieren
// facción + rango para equiparse (factionReq/factionRankReq) y no se caen al morir.
import type { ItemDef } from "./items.js";

export const CUSTOM_ITEMS: Record<number, ItemDef> = {
  2000: { id: 2000, name: "Armadura de Guerrero de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20860, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 500, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 1 },
  2001: { id: 2001, name: "Armadura de Guerrero de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20860, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 500, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 2 },
  2002: { id: 2002, name: "Armadura de Guerrero de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20860, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 500, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 3 },
  2003: { id: 2003, name: "Armadura de Guerrero de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20860, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 500, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 4 },
  2004: { id: 2004, name: "Armadura de Guerrero de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20860, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 500, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 5 },
  2005: { id: 2005, name: "Armadura de Guerrero de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20887, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 501, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 1 },
  2006: { id: 2006, name: "Armadura de Guerrero de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20887, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 501, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 2 },
  2007: { id: 2007, name: "Armadura de Guerrero de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20887, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 501, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 3 },
  2008: { id: 2008, name: "Armadura de Guerrero de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20887, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 501, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 4 },
  2009: { id: 2009, name: "Armadura de Guerrero de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20887, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 501, forbiddenClasses: [2,3,4,5,6], factionReq: 1, factionRankReq: 5 },
  2010: { id: 2010, name: "Armadura de Guerrero de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21454, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 522, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 1 },
  2011: { id: 2011, name: "Armadura de Guerrero de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21454, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 522, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 2 },
  2012: { id: 2012, name: "Armadura de Guerrero de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21454, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 522, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 3 },
  2013: { id: 2013, name: "Armadura de Guerrero de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21454, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 522, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 4 },
  2014: { id: 2014, name: "Armadura de Guerrero de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21454, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 522, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 5 },
  2015: { id: 2015, name: "Armadura de Guerrero de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21481, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 523, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 1 },
  2016: { id: 2016, name: "Armadura de Guerrero de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21481, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 523, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 2 },
  2017: { id: 2017, name: "Armadura de Guerrero de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21481, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 523, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 3 },
  2018: { id: 2018, name: "Armadura de Guerrero de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21481, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 523, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 4 },
  2019: { id: 2019, name: "Armadura de Guerrero de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21481, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 523, forbiddenClasses: [2,3,4,5,6], factionReq: 2, factionRankReq: 5 },
  2020: { id: 2020, name: "Armadura de Mago de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20968, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 504, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 1 },
  2021: { id: 2021, name: "Armadura de Mago de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20968, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 504, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 2 },
  2022: { id: 2022, name: "Armadura de Mago de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20968, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 504, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 3 },
  2023: { id: 2023, name: "Armadura de Mago de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20968, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 504, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 4 },
  2024: { id: 2024, name: "Armadura de Mago de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20968, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 504, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 5 },
  2025: { id: 2025, name: "Armadura de Mago de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20995, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 505, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 1 },
  2026: { id: 2026, name: "Armadura de Mago de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20995, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 505, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 2 },
  2027: { id: 2027, name: "Armadura de Mago de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20995, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 505, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 3 },
  2028: { id: 2028, name: "Armadura de Mago de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20995, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 505, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 4 },
  2029: { id: 2029, name: "Armadura de Mago de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20995, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 505, forbiddenClasses: [1,3,4,5,6], factionReq: 1, factionRankReq: 5 },
  2030: { id: 2030, name: "Armadura de Mago de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21562, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 526, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 1 },
  2031: { id: 2031, name: "Armadura de Mago de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21562, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 526, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 2 },
  2032: { id: 2032, name: "Armadura de Mago de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21562, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 526, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 3 },
  2033: { id: 2033, name: "Armadura de Mago de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21562, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 526, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 4 },
  2034: { id: 2034, name: "Armadura de Mago de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21562, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 526, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 5 },
  2035: { id: 2035, name: "Armadura de Mago de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21589, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 527, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 1 },
  2036: { id: 2036, name: "Armadura de Mago de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21589, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 527, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 2 },
  2037: { id: 2037, name: "Armadura de Mago de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21589, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 527, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 3 },
  2038: { id: 2038, name: "Armadura de Mago de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21589, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 527, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 4 },
  2039: { id: 2039, name: "Armadura de Mago de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21589, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 527, forbiddenClasses: [1,3,4,5,6], factionReq: 2, factionRankReq: 5 },
  2040: { id: 2040, name: "Armadura de Clérigo de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20752, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 496, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 1 },
  2041: { id: 2041, name: "Armadura de Clérigo de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20752, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 496, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 2 },
  2042: { id: 2042, name: "Armadura de Clérigo de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20752, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 496, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 3 },
  2043: { id: 2043, name: "Armadura de Clérigo de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20752, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 496, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 4 },
  2044: { id: 2044, name: "Armadura de Clérigo de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20752, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 496, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 5 },
  2045: { id: 2045, name: "Armadura de Clérigo de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20779, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 497, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 1 },
  2046: { id: 2046, name: "Armadura de Clérigo de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20779, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 497, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 2 },
  2047: { id: 2047, name: "Armadura de Clérigo de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20779, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 497, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 3 },
  2048: { id: 2048, name: "Armadura de Clérigo de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20779, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 497, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 4 },
  2049: { id: 2049, name: "Armadura de Clérigo de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20779, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 497, forbiddenClasses: [1,2,4,5,6], factionReq: 1, factionRankReq: 5 },
  2050: { id: 2050, name: "Armadura de Clérigo de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21346, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 518, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 1 },
  2051: { id: 2051, name: "Armadura de Clérigo de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21346, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 518, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 2 },
  2052: { id: 2052, name: "Armadura de Clérigo de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21346, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 518, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 3 },
  2053: { id: 2053, name: "Armadura de Clérigo de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21346, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 518, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 4 },
  2054: { id: 2054, name: "Armadura de Clérigo de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21346, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 518, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 5 },
  2055: { id: 2055, name: "Armadura de Clérigo de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21373, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 519, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 1 },
  2056: { id: 2056, name: "Armadura de Clérigo de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21373, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 519, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 2 },
  2057: { id: 2057, name: "Armadura de Clérigo de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21373, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 519, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 3 },
  2058: { id: 2058, name: "Armadura de Clérigo de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21373, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 519, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 4 },
  2059: { id: 2059, name: "Armadura de Clérigo de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21373, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 519, forbiddenClasses: [1,2,4,5,6], factionReq: 2, factionRankReq: 5 },
  2060: { id: 2060, name: "Armadura de Cazador de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20698, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 494, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 1 },
  2061: { id: 2061, name: "Armadura de Cazador de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20698, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 494, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 2 },
  2062: { id: 2062, name: "Armadura de Cazador de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20698, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 494, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 3 },
  2063: { id: 2063, name: "Armadura de Cazador de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20698, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 494, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 4 },
  2064: { id: 2064, name: "Armadura de Cazador de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20698, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 494, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 5 },
  2065: { id: 2065, name: "Armadura de Cazador de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20725, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 495, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 1 },
  2066: { id: 2066, name: "Armadura de Cazador de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20725, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 495, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 2 },
  2067: { id: 2067, name: "Armadura de Cazador de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20725, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 495, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 3 },
  2068: { id: 2068, name: "Armadura de Cazador de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20725, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 495, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 4 },
  2069: { id: 2069, name: "Armadura de Cazador de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20725, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 495, forbiddenClasses: [1,2,3,5,6], factionReq: 1, factionRankReq: 5 },
  2070: { id: 2070, name: "Armadura de Cazador de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21292, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 516, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 1 },
  2071: { id: 2071, name: "Armadura de Cazador de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21292, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 516, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 2 },
  2072: { id: 2072, name: "Armadura de Cazador de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21292, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 516, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 3 },
  2073: { id: 2073, name: "Armadura de Cazador de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21292, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 516, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 4 },
  2074: { id: 2074, name: "Armadura de Cazador de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21292, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 516, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 5 },
  2075: { id: 2075, name: "Armadura de Cazador de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21319, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 517, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 1 },
  2076: { id: 2076, name: "Armadura de Cazador de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21319, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 517, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 2 },
  2077: { id: 2077, name: "Armadura de Cazador de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21319, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 517, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 3 },
  2078: { id: 2078, name: "Armadura de Cazador de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21319, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 517, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 4 },
  2079: { id: 2079, name: "Armadura de Cazador de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21319, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 517, forbiddenClasses: [1,2,3,5,6], factionReq: 2, factionRankReq: 5 },
  2080: { id: 2080, name: "Armadura de Asesino de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20536, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 488, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 1 },
  2081: { id: 2081, name: "Armadura de Asesino de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20536, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 488, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 2 },
  2082: { id: 2082, name: "Armadura de Asesino de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20536, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 488, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 3 },
  2083: { id: 2083, name: "Armadura de Asesino de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20536, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 488, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 4 },
  2084: { id: 2084, name: "Armadura de Asesino de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20536, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 488, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 5 },
  2085: { id: 2085, name: "Armadura de Asesino de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20563, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 489, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 1 },
  2086: { id: 2086, name: "Armadura de Asesino de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20563, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 489, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 2 },
  2087: { id: 2087, name: "Armadura de Asesino de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20563, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 489, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 3 },
  2088: { id: 2088, name: "Armadura de Asesino de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20563, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 489, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 4 },
  2089: { id: 2089, name: "Armadura de Asesino de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20563, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 489, forbiddenClasses: [1,2,3,4,6], factionReq: 1, factionRankReq: 5 },
  2090: { id: 2090, name: "Armadura de Asesino de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21130, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 510, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 1 },
  2091: { id: 2091, name: "Armadura de Asesino de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21130, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 510, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 2 },
  2092: { id: 2092, name: "Armadura de Asesino de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21130, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 510, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 3 },
  2093: { id: 2093, name: "Armadura de Asesino de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21130, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 510, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 4 },
  2094: { id: 2094, name: "Armadura de Asesino de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21130, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 510, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 5 },
  2095: { id: 2095, name: "Armadura de Asesino de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21157, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 511, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 1 },
  2096: { id: 2096, name: "Armadura de Asesino de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21157, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 511, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 2 },
  2097: { id: 2097, name: "Armadura de Asesino de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21157, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 511, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 3 },
  2098: { id: 2098, name: "Armadura de Asesino de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21157, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 511, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 4 },
  2099: { id: 2099, name: "Armadura de Asesino de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21157, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 511, forbiddenClasses: [1,2,3,4,6], factionReq: 2, factionRankReq: 5 },
  2100: { id: 2100, name: "Armadura de Druida de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20806, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 498, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 1 },
  2101: { id: 2101, name: "Armadura de Druida de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20806, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 498, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 2 },
  2102: { id: 2102, name: "Armadura de Druida de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20806, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 498, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 3 },
  2103: { id: 2103, name: "Armadura de Druida de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20806, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 498, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 4 },
  2104: { id: 2104, name: "Armadura de Druida de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 20806, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 498, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 5 },
  2105: { id: 2105, name: "Armadura de Druida de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20833, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 499, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 1 },
  2106: { id: 2106, name: "Armadura de Druida de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20833, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 499, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 2 },
  2107: { id: 2107, name: "Armadura de Druida de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20833, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 499, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 3 },
  2108: { id: 2108, name: "Armadura de Druida de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20833, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 499, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 4 },
  2109: { id: 2109, name: "Armadura de Druida de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 20833, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 499, forbiddenClasses: [1,2,3,4,5], factionReq: 1, factionRankReq: 5 },
  2110: { id: 2110, name: "Armadura de Druida de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21400, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 520, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 1 },
  2111: { id: 2111, name: "Armadura de Druida de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21400, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 520, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 2 },
  2112: { id: 2112, name: "Armadura de Druida de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21400, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 520, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 3 },
  2113: { id: 2113, name: "Armadura de Druida de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21400, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 520, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 4 },
  2114: { id: 2114, name: "Armadura de Druida de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21400, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 520, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 5 },
  2115: { id: 2115, name: "Armadura de Druida de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21427, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 521, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 1 },
  2116: { id: 2116, name: "Armadura de Druida de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21427, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 521, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 2 },
  2117: { id: 2117, name: "Armadura de Druida de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21427, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 521, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 3 },
  2118: { id: 2118, name: "Armadura de Druida de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21427, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 521, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 4 },
  2119: { id: 2119, name: "Armadura de Druida de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21427, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 521, forbiddenClasses: [1,2,3,4,5], factionReq: 2, factionRankReq: 5 },
  2120: { id: 2120, name: "Armadura de Paladín de 1ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 21022, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 506, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 1 },
  2121: { id: 2121, name: "Armadura de Paladín de 2da Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 21022, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 506, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 2 },
  2122: { id: 2122, name: "Armadura de Paladín de 3ra Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 21022, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 506, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 3 },
  2123: { id: 2123, name: "Armadura de Paladín de 4ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 21022, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 506, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 4 },
  2124: { id: 2124, name: "Armadura de Paladín de 5ta Jerarquía (Armada)", type: "armor", objType: 3, value: 0, graphic: 21022, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 506, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 5 },
  2125: { id: 2125, name: "Armadura de Paladín de 1ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21049, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 507, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 1 },
  2126: { id: 2126, name: "Armadura de Paladín de 2da Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21049, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 507, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 2 },
  2127: { id: 2127, name: "Armadura de Paladín de 3ra Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21049, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 507, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 3 },
  2128: { id: 2128, name: "Armadura de Paladín de 4ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21049, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 507, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 4 },
  2129: { id: 2129, name: "Armadura de Paladín de 5ta Jerarquía (Armada) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21049, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 507, forbiddenClasses: [1,2,3,4,5,6], factionReq: 1, factionRankReq: 5 },
  2130: { id: 2130, name: "Armadura de Paladín de 1ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21616, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 528, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 1 },
  2131: { id: 2131, name: "Armadura de Paladín de 2da Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21616, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 528, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 2 },
  2132: { id: 2132, name: "Armadura de Paladín de 3ra Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21616, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 528, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 3 },
  2133: { id: 2133, name: "Armadura de Paladín de 4ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21616, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 528, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 4 },
  2134: { id: 2134, name: "Armadura de Paladín de 5ta Jerarquía (Caos)", type: "armor", objType: 3, value: 0, graphic: 21616, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 528, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 5 },
  2135: { id: 2135, name: "Armadura de Paladín de 1ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21643, defense: 10, defenseMin: 10, defenseMax: 10, bodyId: 529, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 1 },
  2136: { id: 2136, name: "Armadura de Paladín de 2da Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21643, defense: 18, defenseMin: 18, defenseMax: 18, bodyId: 529, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 2 },
  2137: { id: 2137, name: "Armadura de Paladín de 3ra Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21643, defense: 26, defenseMin: 26, defenseMax: 26, bodyId: 529, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 3 },
  2138: { id: 2138, name: "Armadura de Paladín de 4ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21643, defense: 34, defenseMin: 34, defenseMax: 34, bodyId: 529, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 4 },
  2139: { id: 2139, name: "Armadura de Paladín de 5ta Jerarquía (Caos) (E/G)", type: "armor", objType: 3, value: 0, graphic: 21643, defense: 42, defenseMin: 42, defenseMax: 42, bodyId: 529, forbiddenClasses: [1,2,3,4,5,6], factionReq: 2, factionRankReq: 5 },
};

// Lookup de recompensa: por facción (1 Armada · 2 Caos) → clase → variante de
// raza (alto = Humano/Elfo/Elfo Oscuro · eg = Gnomo/Enano) → [id jer1..jer5].
export const FACTION_RANK_ARMOR: Record<number, Record<number, { alto: number[]; eg: number[] }>> =
{
  "1": {
    "1": {
      "alto": [
        2000,
        2001,
        2002,
        2003,
        2004
      ],
      "eg": [
        2005,
        2006,
        2007,
        2008,
        2009
      ]
    },
    "2": {
      "alto": [
        2020,
        2021,
        2022,
        2023,
        2024
      ],
      "eg": [
        2025,
        2026,
        2027,
        2028,
        2029
      ]
    },
    "3": {
      "alto": [
        2040,
        2041,
        2042,
        2043,
        2044
      ],
      "eg": [
        2045,
        2046,
        2047,
        2048,
        2049
      ]
    },
    "4": {
      "alto": [
        2060,
        2061,
        2062,
        2063,
        2064
      ],
      "eg": [
        2065,
        2066,
        2067,
        2068,
        2069
      ]
    },
    "5": {
      "alto": [
        2080,
        2081,
        2082,
        2083,
        2084
      ],
      "eg": [
        2085,
        2086,
        2087,
        2088,
        2089
      ]
    },
    "6": {
      "alto": [
        2100,
        2101,
        2102,
        2103,
        2104
      ],
      "eg": [
        2105,
        2106,
        2107,
        2108,
        2109
      ]
    },
    "7": {
      "alto": [
        2120,
        2121,
        2122,
        2123,
        2124
      ],
      "eg": [
        2125,
        2126,
        2127,
        2128,
        2129
      ]
    }
  },
  "2": {
    "1": {
      "alto": [
        2010,
        2011,
        2012,
        2013,
        2014
      ],
      "eg": [
        2015,
        2016,
        2017,
        2018,
        2019
      ]
    },
    "2": {
      "alto": [
        2030,
        2031,
        2032,
        2033,
        2034
      ],
      "eg": [
        2035,
        2036,
        2037,
        2038,
        2039
      ]
    },
    "3": {
      "alto": [
        2050,
        2051,
        2052,
        2053,
        2054
      ],
      "eg": [
        2055,
        2056,
        2057,
        2058,
        2059
      ]
    },
    "4": {
      "alto": [
        2070,
        2071,
        2072,
        2073,
        2074
      ],
      "eg": [
        2075,
        2076,
        2077,
        2078,
        2079
      ]
    },
    "5": {
      "alto": [
        2090,
        2091,
        2092,
        2093,
        2094
      ],
      "eg": [
        2095,
        2096,
        2097,
        2098,
        2099
      ]
    },
    "6": {
      "alto": [
        2110,
        2111,
        2112,
        2113,
        2114
      ],
      "eg": [
        2115,
        2116,
        2117,
        2118,
        2119
      ]
    },
    "7": {
      "alto": [
        2130,
        2131,
        2132,
        2133,
        2134
      ],
      "eg": [
        2135,
        2136,
        2137,
        2138,
        2139
      ]
    }
  }
};

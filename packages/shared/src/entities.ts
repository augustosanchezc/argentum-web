export type EntityId = number & { readonly __brand: "EntityId" };

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export type Direction = "north" | "south" | "east" | "west";

// Distingue entidades controladas por jugadores de las controladas por el
// servidor. "npc" = hostil; "merchant" = comerciante (tienda); "banker" = banquero.
export type EntityKind = "player" | "npc" | "merchant" | "banker";

export interface CharacterSummary {
  readonly id: EntityId;
  readonly name: string;
  readonly level: number;
  readonly classId: number;
}

export type EntityId = number & { readonly __brand: "EntityId" };

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export type Direction = "north" | "south" | "east" | "west";

export interface CharacterSummary {
  readonly id: EntityId;
  readonly name: string;
  readonly level: number;
}

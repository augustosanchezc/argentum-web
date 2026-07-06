import type { InventorySlot } from "@ao/shared";

// Trade (E-4.4): estado en memoria. No se persiste.
// Atomicidad garantizada por el event loop de Node.js (ADR-007).

export interface TradeOffer {
  items: InventorySlot[];
  gold: number;
  confirmed: boolean;
}

export interface Trade {
  readonly id: string;
  readonly playerA: number; // characterId del iniciador
  readonly playerB: number; // characterId del aceptante
  offerA: TradeOffer;
  offerB: TradeOffer;
  readonly createdAt: number;
}

// Invitación de trade pendiente: A quiere tradear con B.
export interface TradeInvite {
  readonly initiatorId: number;
  readonly initiatorName: string;
  readonly invitedId: number;
  readonly expiresAt: number;
}

const INVITE_TTL_MS = 30_000;

class TradeRegistry {
  private readonly trades = new Map<string, Trade>();
  private readonly byCharacter = new Map<number, string>(); // characterId → tradeId
  private readonly pendingInvites = new Map<number, TradeInvite>(); // invitedId → invite
  private nextId = 1;

  create(playerA: number, playerB: number): Trade {
    const id = `t${this.nextId++}`;
    const emptyOffer = (): TradeOffer => ({ items: [], gold: 0, confirmed: false });
    const trade: Trade = {
      id,
      playerA,
      playerB,
      offerA: emptyOffer(),
      offerB: emptyOffer(),
      createdAt: Date.now(),
    };
    this.trades.set(id, trade);
    this.byCharacter.set(playerA, id);
    this.byCharacter.set(playerB, id);
    return trade;
  }

  getByCharacter(characterId: number): Trade | undefined {
    const id = this.byCharacter.get(characterId);
    return id ? this.trades.get(id) : undefined;
  }

  remove(tradeId: string): Trade | null {
    const trade = this.trades.get(tradeId);
    if (!trade) return null;
    this.byCharacter.delete(trade.playerA);
    this.byCharacter.delete(trade.playerB);
    this.trades.delete(tradeId);
    return trade;
  }

  addInvite(initiatorId: number, initiatorName: string, invitedId: number): void {
    this.pendingInvites.set(invitedId, {
      initiatorId,
      initiatorName,
      invitedId,
      expiresAt: Date.now() + INVITE_TTL_MS,
    });
  }

  getInvite(invitedId: number): TradeInvite | undefined {
    const inv = this.pendingInvites.get(invitedId);
    if (!inv) return undefined;
    if (Date.now() > inv.expiresAt) {
      this.pendingInvites.delete(invitedId);
      return undefined;
    }
    return inv;
  }

  removeInvite(invitedId: number): void {
    this.pendingInvites.delete(invitedId);
  }
}

export const tradeRegistry = new TradeRegistry();

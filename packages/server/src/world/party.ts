// Party (E-4.3): estado en memoria. No se persiste entre sesiones.

export interface PartyMember {
  readonly characterId: number;
  name: string;
  hp: number;
  maxHp: number;
}

export interface Party {
  readonly id: string;
  leaderCharacterId: number;
  readonly members: Map<number, PartyMember>; // key = characterId
}

// Invitación pendiente: A invitó a B.
export interface PartyInvite {
  readonly inviterId: number;
  readonly inviterName: string;
  readonly invitedId: number;
  readonly expiresAt: number; // epoch ms
}

const INVITE_TTL_MS = 30_000;

class PartyRegistry {
  private readonly parties = new Map<string, Party>();
  private readonly byCharacter = new Map<number, string>(); // characterId → partyId
  private readonly pendingInvites = new Map<number, PartyInvite>(); // invitedId → invite
  private nextId = 1;

  // Crea una party con el líder ya dentro.
  create(leaderId: number, leaderName: string): Party {
    const id = `p${this.nextId++}`;
    const party: Party = {
      id,
      leaderCharacterId: leaderId,
      members: new Map([
        [leaderId, { characterId: leaderId, name: leaderName, hp: 0, maxHp: 0 }],
      ]),
    };
    this.parties.set(id, party);
    this.byCharacter.set(leaderId, id);
    return party;
  }

  getByCharacter(characterId: number): Party | undefined {
    const id = this.byCharacter.get(characterId);
    return id ? this.parties.get(id) : undefined;
  }

  get(id: string): Party | undefined {
    return this.parties.get(id);
  }

  // Agrega un miembro a una party existente.
  addMember(party: Party, characterId: number, name: string): void {
    party.members.set(characterId, { characterId, name, hp: 0, maxHp: 0 });
    this.byCharacter.set(characterId, party.id);
  }

  // Elimina un miembro. Devuelve true si la party quedó vacía y fue disuelta.
  removeMember(characterId: number): { disbanded: boolean; party: Party | null } {
    const partyId = this.byCharacter.get(characterId);
    if (!partyId) return { disbanded: false, party: null };
    const party = this.parties.get(partyId);
    if (!party) return { disbanded: false, party: null };

    party.members.delete(characterId);
    this.byCharacter.delete(characterId);

    if (party.members.size === 0) {
      this.parties.delete(partyId);
      return { disbanded: true, party };
    }
    // Si el líder se fue, el nuevo líder es el primer miembro restante.
    if (party.leaderCharacterId === characterId) {
      party.leaderCharacterId = party.members.keys().next().value as number;
    }
    return { disbanded: false, party };
  }

  // Disuelve toda la party (ej. líder desconectado con solo 2 miembros).
  disband(partyId: string): Party | null {
    const party = this.parties.get(partyId);
    if (!party) return null;
    for (const memberId of party.members.keys()) {
      this.byCharacter.delete(memberId);
    }
    this.parties.delete(partyId);
    return party;
  }

  // Invitaciones pendientes.
  addInvite(inviterId: number, inviterName: string, invitedId: number): void {
    this.pendingInvites.set(invitedId, {
      inviterId,
      inviterName,
      invitedId,
      expiresAt: Date.now() + INVITE_TTL_MS,
    });
  }

  getInvite(invitedId: number): PartyInvite | undefined {
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

  updateMemberStats(characterId: number, hp: number, maxHp: number): void {
    const party = this.getByCharacter(characterId);
    if (!party) return;
    const member = party.members.get(characterId);
    if (member) {
      member.hp = hp;
      member.maxHp = maxHp;
    }
  }
}

export const partyRegistry = new PartyRegistry();

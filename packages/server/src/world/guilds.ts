import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { guilds, guildRequests } from "../db/schema/guilds.js";
import { characters } from "../db/schema/characters.js";
import type { Session } from "../ws/sessions.js";
import { isCriminal } from "./criminal.js";

// Clanes — núcleo del modGuilds.bas del AO original (adaptado a las house rules).
// Requisitos para fundar: nivel >= 38 y pagar 1.500.000 monedas.
export const GUILD_MIN_LEVEL = 38;
export const GUILD_COST = 1_500_000;
// Máximo de miembros por clan.
export const GUILD_MAX_MEMBERS = 12;
// Facción del clan (no se mezclan): 0 = ciudadano · 1 = criminal.
export const GUILD_FACTION_CITIZEN = 0;
export const GUILD_FACTION_CRIMINAL = 1;
// Descripción / reglas: límites de longitud (se recortan en el server).
export const GUILD_DESC_MAX = 500;
export const GUILD_RULES_MAX = 1000;
// Nombre: 3-30 caracteres, letras/números/espacios (GuildName$Valido).
const GUILD_NAME_RE = /^[a-záéíóúüñ0-9][a-záéíóúüñ0-9 ]{1,28}[a-záéíóúüñ0-9]$/i;

// Facción (ciudadano/criminal) que le corresponde a un personaje AHORA.
export function sessionFaction(s: Session): number {
  return isCriminal(s) ? GUILD_FACTION_CRIMINAL : GUILD_FACTION_CITIZEN;
}

export function factionName(faction: number): string {
  return faction === GUILD_FACTION_CRIMINAL ? "Criminales" : "Ciudadanos";
}

export function canFoundGuild(s: Session): string | null {
  if (s.guildId) return "Ya perteneces a un clan.";
  if (s.level < GUILD_MIN_LEVEL) {
    return `Para fundar un clan debes ser nivel ${GUILD_MIN_LEVEL} o superior.`;
  }
  if (s.gold < GUILD_COST) {
    return `Fundar un clan cuesta ${GUILD_COST.toLocaleString("es")} monedas de oro.`;
  }
  return null;
}

export function validGuildName(name: string): boolean {
  return GUILD_NAME_RE.test(name.trim());
}

// Crea el clan (con su facción) y suma al fundador. Devuelve null si el nombre
// ya existe. El descuento de oro lo hace el handler (necesita notificar stats).
export async function createGuild(
  name: string,
  leader: Session,
  faction: number,
): Promise<{ id: number; name: string } | null> {
  const trimmed = name.trim();
  try {
    const [row] = await db
      .insert(guilds)
      .values({ name: trimmed, leaderId: leader.characterId, faction })
      .returning({ id: guilds.id, name: guilds.name });
    if (!row) return null;
    await db
      .update(characters)
      .set({ guildId: row.id })
      .where(eq(characters.id, leader.characterId));
    return row;
  } catch {
    // Índice único lower(name) — nombre tomado.
    return null;
  }
}

// Info del clan para validaciones y para el popup.
export interface GuildInfo {
  readonly id: number;
  readonly name: string;
  readonly leaderId: number;
  readonly faction: number;
  readonly description: string;
  readonly rules: string;
}

export async function getGuild(guildId: number): Promise<GuildInfo | null> {
  const [g] = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      leaderId: guilds.leaderId,
      faction: guilds.faction,
      description: guilds.description,
      rules: guilds.rules,
    })
    .from(guilds)
    .where(eq(guilds.id, guildId));
  return g ?? null;
}

// Miembros del clan (para el listado del popup). Ordena por nivel desc.
export interface GuildMemberRow {
  readonly id: number;
  readonly name: string;
  readonly level: number;
  readonly classId: number;
  readonly rank: number;
}

export async function getGuildMembers(guildId: number): Promise<GuildMemberRow[]> {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      level: characters.level,
      classId: characters.classId,
      rank: characters.guildRank,
    })
    .from(characters)
    .where(eq(characters.guildId, guildId))
    .orderBy(sql`${characters.level} desc`);
}

// ── Directorio de clanes (para el popup cuando NO estás en ninguno) ─────────
export interface GuildSummary {
  readonly id: number;
  readonly name: string;
  readonly faction: number;
  readonly leaderName: string;
  readonly memberCount: number;
  readonly description: string;
}

export async function listGuilds(): Promise<GuildSummary[]> {
  const gs = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      faction: guilds.faction,
      leaderId: guilds.leaderId,
      description: guilds.description,
    })
    .from(guilds)
    .orderBy(guilds.name);
  if (gs.length === 0) return [];
  // Conteo de miembros por clan.
  const countRows = await db
    .select({ gid: characters.guildId, n: sql<number>`count(*)::int` })
    .from(characters)
    .where(isNotNull(characters.guildId))
    .groupBy(characters.guildId);
  const counts = new Map<number, number>();
  for (const r of countRows) if (r.gid !== null) counts.set(r.gid, r.n);
  // Nombres de los líderes.
  const leaders = await db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(inArray(characters.id, gs.map((g) => g.leaderId)));
  const leaderNames = new Map<number, string>();
  for (const l of leaders) leaderNames.set(l.id, l.name);
  return gs.map((g) => ({
    id: g.id,
    name: g.name,
    faction: g.faction,
    leaderName: leaderNames.get(g.leaderId) ?? "?",
    memberCount: counts.get(g.id) ?? 0,
    description: g.description,
  }));
}

// ── Solicitudes de ingreso (persistentes) ──────────────────────────────────
// El jugador pide unirse; el líder u oficial (rank≥1) aprueba/rechaza.
export async function createJoinRequest(guildId: number, member: Session): Promise<string | null> {
  const reason = await canJoinGuild(guildId, member); // sin clan + facción + cupo
  if (reason) return reason;
  try {
    await db.insert(guildRequests).values({ guildId, characterId: member.characterId });
    return null;
  } catch {
    return "Ya enviaste una solicitud a ese clan.";
  }
}

export interface GuildRequestRow {
  readonly characterId: number;
  readonly name: string;
  readonly level: number;
  readonly classId: number;
}

export async function listJoinRequests(guildId: number): Promise<GuildRequestRow[]> {
  return db
    .select({
      characterId: characters.id,
      name: characters.name,
      level: characters.level,
      classId: characters.classId,
    })
    .from(guildRequests)
    .innerJoin(characters, eq(characters.id, guildRequests.characterId))
    .where(eq(guildRequests.guildId, guildId))
    .orderBy(guildRequests.createdAt);
}

// Ids de los clanes a los que este personaje ya mandó solicitud (para marcar
// "Solicitado" en el directorio).
export async function guildIdsRequestedBy(characterId: number): Promise<number[]> {
  const rows = await db
    .select({ guildId: guildRequests.guildId })
    .from(guildRequests)
    .where(eq(guildRequests.characterId, characterId));
  return rows.map((r) => r.guildId);
}

export async function deleteJoinRequest(guildId: number, characterId: number): Promise<void> {
  await db
    .delete(guildRequests)
    .where(and(eq(guildRequests.guildId, guildId), eq(guildRequests.characterId, characterId)));
}

// Al entrar a un clan (o fundarlo) se limpian TODAS las solicitudes del personaje.
export async function clearRequestsForCharacter(characterId: number): Promise<void> {
  await db.delete(guildRequests).where(eq(guildRequests.characterId, characterId));
}

// Al disolverse un clan se borran sus solicitudes pendientes.
export async function clearRequestsForGuild(guildId: number): Promise<void> {
  await db.delete(guildRequests).where(eq(guildRequests.guildId, guildId));
}

// ── Rangos dentro del clan ─────────────────────────────────────────────────
export async function setGuildRank(characterId: number, rank: number): Promise<void> {
  await db.update(characters).set({ guildRank: rank }).where(eq(characters.id, characterId));
}

// ¿La sesión puede gestionar el clan (aprobar solicitudes, etc.)? Líder u oficial.
export function canManageGuild(s: Session, guild: GuildInfo): boolean {
  return guild.leaderId === s.characterId || s.guildRank >= 1;
}

// Chequea si un personaje puede unirse: sin clan, cupo disponible y misma
// facción que el clan. Devuelve el motivo del rechazo, o null si puede.
export async function canJoinGuild(guildId: number, member: Session): Promise<string | null> {
  if (member.guildId) return "Ya perteneces a un clan.";
  const g = await getGuild(guildId);
  if (!g) return "Ese clan ya no existe.";
  const count = await guildMemberCount(guildId);
  if (count >= GUILD_MAX_MEMBERS) return `El clan está lleno (máximo ${GUILD_MAX_MEMBERS} miembros).`;
  if (sessionFaction(member) !== g.faction) {
    return `Ese clan es de ${factionName(g.faction)}; no podés unirte con tu alineación actual.`;
  }
  return null;
}

// Guarda descripción y reglas (líder). Recorta a los límites.
export async function setGuildText(guildId: number, description: string, rules: string): Promise<void> {
  await db
    .update(guilds)
    .set({
      description: description.slice(0, GUILD_DESC_MAX),
      rules: rules.slice(0, GUILD_RULES_MAX),
    })
    .where(eq(guilds.id, guildId));
}

export async function joinGuild(guildId: number, member: Session): Promise<void> {
  await joinGuildById(guildId, member.characterId);
}

// Suma un personaje (por id) a un clan y le resetea el rango a miembro. Sirve
// para aceptar solicitudes de jugadores offline.
export async function joinGuildById(guildId: number, characterId: number): Promise<void> {
  await db.update(characters).set({ guildId, guildRank: 0 }).where(eq(characters.id, characterId));
}

// Salir del clan. Si el que sale es el líder, el liderazgo pasa al miembro más
// antiguo; si no queda nadie, el clan se disuelve.
export async function leaveGuild(member: Session): Promise<{ disbanded: boolean; newLeaderId: number | null }> {
  const guildId = member.guildId;
  await db.update(characters).set({ guildId: null }).where(eq(characters.id, member.characterId));
  if (!guildId) return { disbanded: false, newLeaderId: null };

  const remaining = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.guildId, guildId))
    .orderBy(characters.id)
    .limit(1);
  if (remaining.length === 0) {
    await db.delete(guilds).where(eq(guilds.id, guildId));
    return { disbanded: true, newLeaderId: null };
  }
  const [g] = await db
    .select({ leaderId: guilds.leaderId })
    .from(guilds)
    .where(eq(guilds.id, guildId));
  if (g && g.leaderId === member.characterId) {
    await db.update(guilds).set({ leaderId: remaining[0].id }).where(eq(guilds.id, guildId));
    return { disbanded: false, newLeaderId: remaining[0].id };
  }
  return { disbanded: false, newLeaderId: null };
}

export async function isGuildLeader(s: Session): Promise<boolean> {
  if (!s.guildId) return false;
  const [g] = await db
    .select({ leaderId: guilds.leaderId })
    .from(guilds)
    .where(eq(guilds.id, s.guildId));
  return g?.leaderId === s.characterId;
}

export async function guildMemberCount(guildId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(characters)
    .where(eq(characters.guildId, guildId));
  return row?.n ?? 0;
}

import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { guilds } from "../db/schema/guilds.js";
import { characters } from "../db/schema/characters.js";
import type { Session } from "../ws/sessions.js";

// Clanes — núcleo del modGuilds.bas del AO original.
// Requisitos para fundar (CrearNuevoClan): nivel >= 25 y Liderazgo >= 90.
export const GUILD_MIN_LEVEL = 25;
export const GUILD_MIN_LEADERSHIP = 90;
// Nombre: 3-30 caracteres, letras/números/espacios (GuildName$Valido).
const GUILD_NAME_RE = /^[a-záéíóúüñ0-9][a-záéíóúüñ0-9 ]{1,28}[a-záéíóúüñ0-9]$/i;

export function canFoundGuild(s: Session): string | null {
  if (s.guildId) return "Ya perteneces a un clan.";
  if (s.level < GUILD_MIN_LEVEL) {
    return `Para fundar un clan debes ser nivel ${GUILD_MIN_LEVEL} o superior.`;
  }
  if ((s.skills.liderazgo ?? 0) < GUILD_MIN_LEADERSHIP) {
    return `Para fundar un clan necesitas ${GUILD_MIN_LEADERSHIP} puntos en Liderazgo.`;
  }
  return null;
}

export function validGuildName(name: string): boolean {
  return GUILD_NAME_RE.test(name.trim());
}

// Crea el clan y suma al fundador. Devuelve null si el nombre ya existe.
export async function createGuild(
  name: string,
  leader: Session,
): Promise<{ id: number; name: string } | null> {
  const trimmed = name.trim();
  try {
    const [row] = await db
      .insert(guilds)
      .values({ name: trimmed, leaderId: leader.characterId })
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

export async function joinGuild(guildId: number, member: Session): Promise<void> {
  await db.update(characters).set({ guildId }).where(eq(characters.id, member.characterId));
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

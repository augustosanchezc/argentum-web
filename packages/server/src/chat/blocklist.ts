// Filtro básico de contenido ofensivo para el chat (T-038).
//
// Configurable: la lista por defecto se puede ampliar o reemplazar con la
// variable de entorno CHAT_BLOCKLIST (palabras separadas por coma). Las
// palabras de entorno se SUMAN a las por defecto salvo que CHAT_BLOCKLIST
// empiece con "=", en cuyo caso reemplazan a las por defecto.

// Lista mínima por defecto. La idea no es ser exhaustiva (eso es un servicio
// aparte en producción) sino tener el gancho funcionando y testeable.
const DEFAULT_BLOCKLIST: readonly string[] = [
  "puto",
  "puta",
  "mierda",
  "pelotudo",
  "boludo",
  "concha",
  "forro",
  "trolo",
];

// Normaliza para comparar: minúsculas, sin tildes/diacríticos, y un par de
// sustituciones de leetspeak comunes (0→o, 1→i, 3→e, 4→a, 5→s, @→a).
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/0/gu, "o")
    .replace(/1/gu, "i")
    .replace(/3/gu, "e")
    .replace(/4/gu, "a")
    .replace(/5/gu, "s")
    .replace(/@/gu, "a");
}

function buildBlocklist(): string[] {
  const raw = process.env.CHAT_BLOCKLIST;
  if (!raw) return DEFAULT_BLOCKLIST.map(normalize);

  const replace = raw.startsWith("=");
  const words = (replace ? raw.slice(1) : raw)
    .split(",")
    .map((w) => normalize(w.trim()))
    .filter((w) => w.length > 0);

  return replace ? words : [...DEFAULT_BLOCKLIST.map(normalize), ...words];
}

const BLOCKLIST = buildBlocklist();

// Detecta si el texto contiene alguna palabra bloqueada. El match es por
// "palabra contenida" sobre el texto normalizado: alcanza para frenar el
// insulto aunque venga pegado a signos de puntuación.
export function containsBlockedWord(text: string): boolean {
  const normalized = normalize(text);
  return BLOCKLIST.some((word) => word.length > 0 && normalized.includes(word));
}

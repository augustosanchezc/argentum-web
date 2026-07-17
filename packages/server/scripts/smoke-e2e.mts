// Prueba end-to-end headless contra el server corriendo en localhost:3000.
// Registra cuenta → crea personaje (mago) → login WS → valida MapData con
// capas reales, kit newbie, movimiento, chat y cambio de ropaje (drop de
// la armadura → EntityAppearance con el body base).
// Uso: npx tsx packages/server/scripts/smoke-e2e.mts
// WebSocket nativo de Node ≥22 (API browser-like, sin dependencia extra).
import { Packr, Unpackr } from "msgpackr";
import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
} from "@ao/shared";

const BASE = "http://127.0.0.1:3000";
const packr = new Packr({ moreTypes: false });
const unpackr = new Unpackr({ moreTypes: false });

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── 1. Cuenta + personaje via HTTP ───────────────────────────────────────────
const suffix = Math.floor(Math.random() * 1_000_000).toString(36);
const email = `smoke${suffix}@test.local`;
const password = "smoke1234";

const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
assert(reg.ok, `registro de cuenta (${reg.status.toString()})`);

const loginRes = await fetch(`${BASE}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
assert(loginRes.ok, `login HTTP (${loginRes.status.toString()})`);
const { token } = (await loginRes.json()) as { token: string };
assert(typeof token === "string" && token.length > 10, "token JWT recibido");

const charName = `Smoke${suffix}`.slice(0, 16).replace(/[^a-zA-Z0-9]/g, "");
const charRes = await fetch(`${BASE}/characters`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: charName, classId: 2 }), // mago: body base 3, ropaje newbie 1
});
assert(charRes.status === 201, `creación de personaje (${charRes.status.toString()})`);
const character = (await charRes.json()) as { id: number; name: string };

// ── 2. WebSocket + handshake ─────────────────────────────────────────────────
const ws = new WebSocket(`ws://127.0.0.1:3000/ws`);
ws.binaryType = "arraybuffer";
const inbox: AnyPacket[] = [];
const waiters: Array<{ match: (p: AnyPacket) => boolean; resolve: (p: AnyPacket) => void }> = [];

ws.addEventListener("message", (ev: MessageEvent) => {
  const pkt = unpackr.unpack(new Uint8Array(ev.data as ArrayBuffer)) as AnyPacket;
  inbox.push(pkt);
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (waiters[i].match(pkt)) {
      const w = waiters[i];
      waiters.splice(i, 1);
      w.resolve(pkt);
    }
  }
});

function send(pkt: unknown): void {
  ws.send(packr.pack(pkt));
}

function waitFor<T extends AnyPacket>(
  match: (p: AnyPacket) => boolean,
  label: string,
  timeoutMs = 5000,
): Promise<T | null> {
  const existing = inbox.find(match);
  if (existing) return Promise.resolve(existing as T);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = waiters.findIndex((w) => w.resolve === wrapped);
      if (idx >= 0) waiters.splice(idx, 1);
      console.log(`  ✗ TIMEOUT esperando ${label}`);
      failed++;
      resolve(null);
    }, timeoutMs);
    const wrapped = (p: AnyPacket): void => {
      clearTimeout(timer);
      resolve(p as T);
    };
    waiters.push({ match, resolve: wrapped });
  });
}

await new Promise<void>((resolve, reject) => {
  ws.addEventListener("open", () => { resolve(); }, { once: true });
  ws.addEventListener("error", () => { reject(new Error("ws error")); }, { once: true });
});

send({
  op: ClientToServerOp.LoginRequest,
  token,
  characterId: character.id,
  clientVersion: PROTOCOL_VERSION,
});

const login = await waitFor<{ op: number; ok: boolean; reason?: string }>(
  (p) => p.op === ServerToClientOp.LoginResponse, "LoginResponse",
);
assert(!!login && login.ok, "handshake WS ok", login?.reason ?? "sin respuesta");

// ── 3. MapData con capas y mundo real ────────────────────────────────────────
interface MapDataP {
  op: number; mapId: number; name: string; width: number; height: number;
  graphic: number[]; layer2: number[]; layer3: number[]; layer4: number[];
  trigger: number[]; blocked: number[];
  entities: Array<{ id: number; name: string; kind: string; bodyId: number; headId: number; position: { x: number; y: number } }>;
}
const mapData = await waitFor<MapDataP>((p) => p.op === ServerToClientOp.MapData, "MapData");
if (mapData) {
  const total = mapData.width * mapData.height;
  assert(mapData.mapId === 1, `spawn en mapa 1 (${mapData.name})`);
  assert(mapData.layer2.length === total, "layer2 presente");
  assert(mapData.layer3.length === total, "layer3 presente");
  assert(mapData.layer4.length === total, "layer4 presente");
  assert(mapData.trigger.length === total, "triggers presentes");
  assert(mapData.layer3.filter((g) => g > 0).length > 100, `capa 3 con objetos (${mapData.layer3.filter((g) => g > 0).length.toString()})`);
  const npcsInMap = mapData.entities.filter((e) => e.kind !== "player");
  assert(npcsInMap.length >= 25, `NPCs reales en mapa 1 (${npcsInMap.length.toString()})`);
  const names = [...new Set(npcsInMap.map((e) => e.name))].slice(0, 8);
  console.log(`    NPCs: ${names.join(", ")}`);
  assert(npcsInMap.some((e) => e.name === "Banquero"), "Banquero de Ulla presente");
  assert(npcsInMap.every((e) => e.bodyId > 0), "todos los NPCs con bodyId real");
}

// ── 4. Inventario: kit newbie real ───────────────────────────────────────────
interface InvP { op: number; slots: Array<{ item: number; qty: number }>; equippedWeapon: number | null; equippedArmor: number | null; gold: number }
const inv = await waitFor<InvP>((p) => p.op === ServerToClientOp.InventoryUpdate, "InventoryUpdate");
if (inv) {
  const items = inv.slots.map((s) => s.item);
  assert(items.includes(862), "Bastón de Mago (Newbie) en inventario");
  assert(items.includes(463), "Vestimentas Comunes (Newbie) en inventario");
  assert(items.includes(857), "Pociones Rojas (Newbie) en inventario");
  assert(items.includes(856), "Pociones Azules (Newbie) en inventario");
  assert(inv.equippedWeapon === 862, "bastón equipado");
  assert(inv.equippedArmor === 463, "vestimentas equipadas");
}

// ── 5. Movimiento con ACK ────────────────────────────────────────────────────
const selfSpawn = mapData?.entities.find((e) => e.id === character.id);
send({ op: ClientToServerOp.Move, direction: "east", sequence: 1 });
const moveAck = await waitFor<{ op: number; id: number; position: { x: number; y: number } }>(
  (p) => p.op === ServerToClientOp.EntityUpdate && (p as { id: number }).id === character.id,
  "EntityUpdate propio",
);
if (moveAck && selfSpawn) {
  const moved = moveAck.position.x !== selfSpawn.position.x || moveAck.position.y !== selfSpawn.position.y;
  assert(moved, `movimiento aplicado (${selfSpawn.position.x.toString()},${selfSpawn.position.y.toString()} → ${moveAck.position.x.toString()},${moveAck.position.y.toString()})`);
}

// ── 6. Chat ──────────────────────────────────────────────────────────────────
send({ op: ClientToServerOp.ChatSend, text: "hola mundo real" });
const chat = await waitFor<{ op: number; text: string }>(
  (p) => p.op === ServerToClientOp.ChatBroadcast, "ChatBroadcast",
);
assert(!!chat && chat.text === "hola mundo real", "chat broadcast recibido");

// ── 7. Ropaje: drop de la armadura → EntityAppearance con body base ─────────
const armorSlot = inv ? inv.slots.findIndex((s) => s.item === 463) : -1;
if (armorSlot >= 0) {
  send({ op: ClientToServerOp.DropItem, slot: armorSlot, qty: 1 });
  const appearance = await waitFor<{ op: number; id: number; bodyId: number }>(
    (p) => p.op === ServerToClientOp.EntityAppearance, "EntityAppearance",
  );
  // Mago: body base 3; con Vestimentas (ropaje 1) entraba como 1.
  assert(!!appearance && appearance.bodyId === 3, `ropaje: al soltar la armadura el body vuelve al base (${appearance?.bodyId.toString() ?? "?"})`);
  const gis = await waitFor<{ op: number; item: number }>(
    (p) => p.op === ServerToClientOp.GroundItemSpawn, "GroundItemSpawn",
  );
  assert(!!gis && gis.item === 463, "armadura tirada al piso");
}

// ── 8. Meditación: toggle → broadcast; moverse la corta ─────────────────────
send({ op: ClientToServerOp.Meditate });
const medOn = await waitFor<{ op: number; id: number; meditating: boolean }>(
  (p) => p.op === ServerToClientOp.MeditateUpdate, "MeditateUpdate on",
);
assert(!!medOn && medOn.meditating, "meditar activado (mago)");
send({ op: ClientToServerOp.Move, direction: "west", sequence: 2 });
const medOff = await waitFor<{ op: number; meditating: boolean }>(
  (p) => p.op === ServerToClientOp.MeditateUpdate && !(p as { meditating: boolean }).meditating,
  "MeditateUpdate off",
);
assert(!!medOff, "meditar se corta al moverse");

// ── 9. Desequipar: doble uso del arma equipada la saca ──────────────────────
send({ op: ClientToServerOp.UseItem, item: 862 });
const invAfter = await waitFor<InvP>(
  (p) => p.op === ServerToClientOp.InventoryUpdate && (p as InvP).equippedWeapon === null,
  "InventoryUpdate sin arma",
);
assert(!!invAfter, "desequipar arma con doble uso");

// ── 10. Hambre/sed en StatsUpdate + libro de hechizos ───────────────────────
const stats = await waitFor<{ op: number; hunger: number; thirst: number }>(
  (p) => p.op === ServerToClientOp.StatsUpdate, "StatsUpdate",
);
assert(!!stats && typeof stats.hunger === "number" && typeof stats.thirst === "number",
  `hambre/sed presentes (${stats?.hunger.toString() ?? "?"}/${stats?.thirst.toString() ?? "?"})`);

const spellsKnown = await waitFor<{ op: number; spellIds: number[] }>(
  (p) => p.op === ServerToClientOp.SpellsKnown, "SpellsKnown",
);
assert(!!spellsKnown && spellsKnown.spellIds.includes(2), "mago conoce Dardo Mágico");

// ── 11. Lanzar Dardo Mágico a un NPC cercano ─────────────────────────────────
const myPos = moveAck?.position ?? { x: 25, y: 25 };
const targetNpc = mapData?.entities.find(
  (e) => e.kind === "npc" &&
    Math.max(Math.abs(e.position.x - myPos.x), Math.abs(e.position.y - myPos.y)) <= 10,
);
if (targetNpc && spellsKnown) {
  send({ op: ClientToServerOp.CastSpell, spellId: 2, targetId: targetNpc.id });
  const dmg = await waitFor<{ op: number; targetId: number; amount: number }>(
    (p) => p.op === ServerToClientOp.Damage && (p as { targetId: number }).targetId === targetNpc.id,
    "Damage por hechizo",
  );
  assert(!!dmg && dmg.amount >= 1, `Dardo Mágico dañó a ${targetNpc.name} (-${dmg?.amount.toString() ?? "?"})`);
} else {
  console.log("  (sin NPC hostil en rango de 10 tiles — casteo no probado en esta corrida)");
}

// ── 12. Clanes: fundar sin nivel 25 debe rechazarse con mensaje ──────────────
interface ConsoleP { op: number; text: string; kind: string }
send({ op: ClientToServerOp.GuildCreate, name: "Clan Smoke" });
const guildDenied = await waitFor<ConsoleP>(
  (p) => p.op === ServerToClientOp.ConsoleMsg && (p as ConsoleP).text.includes("fundar un clan"),
  "ConsoleMsg de clan",
);
assert(!!guildDenied && guildDenied.text.includes("nivel 25"), "fundar clan exige nivel 25 (modGuilds)");

// ── 13. Amigos: agregar + listar ─────────────────────────────────────────────
send({ op: ClientToServerOp.FriendAdd, name: "Tancredo" });
const friendAdded = await waitFor<ConsoleP>(
  (p) => p.op === ServerToClientOp.ConsoleMsg && (p as ConsoleP).text.includes("agregado a tu lista"),
  "ConsoleMsg de amigo agregado",
);
assert(!!friendAdded, "amigo agregado");
send({ op: ClientToServerOp.FriendList });
const friendList = await waitFor<ConsoleP>(
  (p) => p.op === ServerToClientOp.ConsoleMsg && (p as ConsoleP).text.startsWith("Amigos"),
  "ConsoleMsg con lista de amigos",
);
assert(!!friendList && friendList.text.includes("Tancredo (offline)"), "lista de amigos con estado online/offline");

// ── 14. Ocultarse: siempre responde (éxito o fallo, fórmula del Trabajo.bas) ─
send({ op: ClientToServerOp.Hide });
const hideMsg = await waitFor<ConsoleP>(
  (p) => p.op === ServerToClientOp.ConsoleMsg &&
    ((p as ConsoleP).text.includes("escondido entre las sombras") || (p as ConsoleP).text.includes("No has logrado esconderte")),
  "ConsoleMsg de ocultarse",
);
assert(!!hideMsg, `ocultarse responde ("${hideMsg?.text ?? "?"}")`);

// ── 15. GM: promover la cuenta a Dios y togglear la lluvia ───────────────────
// (la promoción se aplica directo en DB; el role se lee fresco al reconectar,
// así que probamos con un segundo login WS)
import { execSync } from "node:child_process";
try {
  execSync(
    `docker exec ao-postgres psql -U argentum -d argentum -c "UPDATE accounts SET role=3 WHERE email='${email}';"`,
    { stdio: "pipe" },
  );
  const ws2 = new WebSocket(`ws://127.0.0.1:3000/ws`);
  ws2.binaryType = "arraybuffer";
  const inbox2: AnyPacket[] = [];
  ws2.addEventListener("message", (ev: MessageEvent) => {
    inbox2.push(unpackr.unpack(new Uint8Array(ev.data as ArrayBuffer)) as AnyPacket);
  });
  await new Promise<void>((res) => { ws2.addEventListener("open", () => { res(); }, { once: true }); });
  ws2.send(packr.pack({ op: ClientToServerOp.LoginRequest, token, characterId: character.id, clientVersion: PROTOCOL_VERSION }));
  await new Promise((r) => setTimeout(r, 800));
  ws2.send(packr.pack({ op: ClientToServerOp.ChatSend, text: "/lluvia" }));
  await new Promise((r) => setTimeout(r, 600));
  const rainOn = inbox2.find((p) => p.op === ServerToClientOp.RainToggle) as { raining: boolean } | undefined;
  assert(!!rainOn && rainOn.raining, "GM /lluvia enciende la lluvia global");
  ws2.send(packr.pack({ op: ClientToServerOp.ChatSend, text: "/lluvia" }));
  await new Promise((r) => setTimeout(r, 600));
  const rainOff = inbox2.filter((p) => p.op === ServerToClientOp.RainToggle).length;
  assert(rainOff >= 2, "GM /lluvia apaga la lluvia global");
  ws2.close();
  execSync(
    `docker exec ao-postgres psql -U argentum -d argentum -c "UPDATE accounts SET role=0 WHERE email='${email}';"`,
    { stdio: "pipe" },
  );
} catch (err) {
  assert(false, "prueba GM /lluvia", String(err));
}

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${passed.toString()} ok, ${failed.toString()} fallos`);
// Cierre prolijo del socket antes de salir (evita el assert de libuv en Windows).
await new Promise<void>((resolve) => {
  ws.addEventListener("close", () => { resolve(); }, { once: true });
  ws.close();
  setTimeout(resolve, 1500);
});
process.exitCode = failed > 0 ? 1 : 0;

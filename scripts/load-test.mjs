// Prueba de carga del servidor de juego (T-050).
//
// Abre N sesiones WebSocket simultaneas, cada una con su propia cuenta y
// personaje, y durante DURATION_S simula juego real: pasos de movimiento y
// ataques al vecino. Mide la latencia move -> ENTITY_UPDATE (ACK del server)
// y reporta P50/P95/max. Falla si P95 >= 200ms o si hubo crashes/desconexiones.
//
// Por que Node y no k6: el protocolo es binario MessagePack y reutilizamos el
// MISMO codec (msgpackr) y los mismos opcodes que produccion. k6 no resuelve
// dependencias npm ni nuestro @ao/shared, asi que mediria un protocolo falso.
//
// Uso (con el server corriendo en localhost:3000):
//   node scripts/load-test.mjs            # 20 sesiones, 120s
//   CLIENTS=50 DURATION_S=60 node scripts/load-test.mjs
//
// Requiere haber instalado deps (usa ws + msgpackr del workspace del server).

import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
// msgpackr es dep directa del server; ws es transitiva (via @fastify/websocket),
// asi que la buscamos en el store de pnpm si el require directo falla.
const require = createRequire(resolve(ROOT, "packages/server/package.json"));
const { Packr, Unpackr } = require("msgpackr");

function loadWs() {
  try {
    return require("ws");
  } catch {
    const pnpmDir = resolve(ROOT, "node_modules/.pnpm");
    const dir = readdirSync(pnpmDir).find((d) => d.startsWith("ws@"));
    if (!dir) throw new Error("no se encontro el paquete 'ws' en node_modules/.pnpm");
    return require(resolve(pnpmDir, dir, "node_modules/ws"));
  }
}
const WebSocket = loadWs();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const CLIENTS = Number(process.env.CLIENTS ?? "20");
const DURATION_S = Number(process.env.DURATION_S ?? "120");
const MOVE_INTERVAL_MS = 220; // un pelo por encima del cooldown del server
const ATTACK_INTERVAL_MS = 850;
const P95_BUDGET_MS = 200;

const packr = new Packr({ moreTypes: false });
const unpackr = new Unpackr({ moreTypes: false });

const C = { LoginRequest: 0x01, Move: 0x10, Attack: 0x30 };
const S = { LoginResponse: 0x81, MapData: 0x90, EntityUpdate: 0x91 };
const DIRS = ["north", "south", "east", "west"];

const ts = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postJson(path, body, token) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}

async function provision(i) {
  const email = `load_${ts}_${i}@test.local`;
  const password = "password123";
  await postJson("/auth/register", { email, password });
  const login = await postJson("/auth/login", { email, password });
  if (login.status !== 200) throw new Error(`login ${i} -> ${login.status}`);
  const token = login.json.token;
  const name = `Load${ts}${i}`.slice(0, 16);
  const create = await postJson("/characters", { name }, token);
  if (create.status !== 201) throw new Error(`create ${i} -> ${create.status}`);
  return { token, characterId: create.json.id };
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
}

class Bot {
  constructor(player) {
    this.player = player;
    this.ws = null;
    this.position = null;
    this.pendingMoveAt = 0; // timestamp del ultimo move sin ACK
    this.latencies = [];
    this.alive = true;
    this.errors = 0;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;
      ws.binaryType = "nodebuffer";
      ws.on("open", () => {
        ws.send(packr.pack({
          op: C.LoginRequest,
          token: this.player.token,
          characterId: this.player.characterId,
          clientVersion: 1,
        }));
      });
      ws.on("message", (buf) => {
        const p = unpackr.unpack(buf);
        if (p.op === S.MapData) {
          const self = p.entities.find((e) => e.id === this.player.characterId);
          if (self) this.position = { ...self.position };
          resolve();
        } else if (p.op === S.EntityUpdate && p.id === this.player.characterId) {
          this.position = { ...p.position };
          if (this.pendingMoveAt > 0) {
            this.latencies.push(performance.now() - this.pendingMoveAt);
            this.pendingMoveAt = 0;
          }
        }
      });
      ws.on("close", () => { this.alive = false; });
      ws.on("error", () => { this.errors += 1; this.alive = false; });
      setTimeout(() => reject(new Error(`handshake timeout ${this.player.characterId}`)), 8000);
    });
  }
  step() {
    if (!this.alive) return;
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.pendingMoveAt = performance.now();
    try { this.ws.send(packr.pack({ op: C.Move, direction: dir, sequence: 0 })); }
    catch { this.errors += 1; }
  }
  attack(targetId) {
    if (!this.alive) return;
    try { this.ws.send(packr.pack({ op: C.Attack, targetId })); }
    catch { this.errors += 1; }
  }
  close() { try { this.ws.close(); } catch { /* */ } }
}

async function main() {
  console.log(`[load] aprovisionando ${CLIENTS} jugadores...`);
  const players = [];
  for (let i = 0; i < CLIENTS; i++) players.push(await provision(i));

  console.log(`[load] conectando ${CLIENTS} sesiones WebSocket...`);
  const bots = players.map((p) => new Bot(p));
  await Promise.all(bots.map((b) => b.connect()));
  console.log(`[load] todas conectadas. Simulando ${DURATION_S}s...`);

  const start = performance.now();
  const moveTimers = bots.map((b) =>
    setInterval(() => { b.step(); }, MOVE_INTERVAL_MS));
  const attackTimers = bots.map((b, i) => {
    const target = bots[(i + 1) % bots.length].player.characterId;
    return setInterval(() => { b.attack(target); }, ATTACK_INTERVAL_MS);
  });

  // Progreso cada 15s.
  const progress = setInterval(() => {
    const elapsed = ((performance.now() - start) / 1000).toFixed(0);
    const aliveN = bots.filter((b) => b.alive).length;
    console.log(`[load] t=${elapsed}s vivos=${aliveN}/${CLIENTS}`);
  }, 15_000);

  await sleep(DURATION_S * 1000);

  moveTimers.forEach(clearInterval);
  attackTimers.forEach(clearInterval);
  clearInterval(progress);
  bots.forEach((b) => { b.close(); });

  const allLatencies = bots.flatMap((b) => b.latencies).sort((a, b) => a - b);
  const totalErrors = bots.reduce((s, b) => s + b.errors, 0);
  const aliveAtEnd = bots.filter((b) => b.alive).length;
  const p50 = percentile(allLatencies, 50);
  const p95 = percentile(allLatencies, 95);
  const max = allLatencies[allLatencies.length - 1] ?? 0;

  console.log("\n=== Resultado load test ===");
  console.log(`sesiones:        ${CLIENTS} (vivas al final: ${aliveAtEnd})`);
  console.log(`muestras move→ACK: ${allLatencies.length}`);
  console.log(`latencia P50:    ${p50.toFixed(1)} ms`);
  console.log(`latencia P95:    ${p95.toFixed(1)} ms  (presupuesto < ${P95_BUDGET_MS}ms)`);
  console.log(`latencia max:    ${max.toFixed(1)} ms`);
  console.log(`errores socket:  ${totalErrors}`);

  const ok = p95 < P95_BUDGET_MS && aliveAtEnd === CLIENTS && totalErrors === 0;
  console.log(`\n${ok ? "PASS" : "FAIL"} — ${ok ? "dentro de presupuesto, sin crashes" : "ver metricas arriba"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(2); });

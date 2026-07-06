import { Counter, Gauge, Histogram, Registry } from "prom-client";

// Registro propio (no el global de prom-client) para evitar conflictos si
// hay múltiples instancias en tests.
export const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({ app: "ao-server" });

// ── Conexiones ────────────────────────────────────────────────────────────────

export const connectedPlayers = new Gauge({
  name: "ao_connected_players",
  help: "Número de jugadores conectados actualmente",
  registers: [metricsRegistry],
});

// ── Mensajes ──────────────────────────────────────────────────────────────────

export const wsMessagesTotal = new Counter({
  name: "ao_ws_messages_total",
  help: "Total de mensajes WebSocket procesados",
  labelNames: ["direction", "op"] as const, // direction: in | out
  registers: [metricsRegistry],
});

// ── Acciones de juego ─────────────────────────────────────────────────────────

export const mapTransitionsTotal = new Counter({
  name: "ao_map_transitions_total",
  help: "Total de transiciones de mapa completadas",
  registers: [metricsRegistry],
});

export const npcKillsTotal = new Counter({
  name: "ao_npc_kills_total",
  help: "Total de NPCs eliminados",
  registers: [metricsRegistry],
});

export const chatMessagesTotal = new Counter({
  name: "ao_chat_messages_total",
  help: "Total de mensajes de chat enviados",
  registers: [metricsRegistry],
});

export const bankOpsTotal = new Counter({
  name: "ao_bank_ops_total",
  help: "Total de operaciones de banco",
  labelNames: ["op"] as const, // deposit_item | withdraw_item | deposit_gold | withdraw_gold
  registers: [metricsRegistry],
});

export const tradeCompletedTotal = new Counter({
  name: "ao_trade_completed_total",
  help: "Total de trades completados exitosamente",
  registers: [metricsRegistry],
});

// ── Latencia ──────────────────────────────────────────────────────────────────

export const wsMessageDurationMs = new Histogram({
  name: "ao_ws_message_duration_ms",
  help: "Duración de procesamiento de mensajes WebSocket en ms",
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100],
  registers: [metricsRegistry],
});

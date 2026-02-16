import { config } from "../config.js";
import { log as auditLog } from "../db/auditLog.js";
import { logger } from "../logger.js";

interface UserFloodState {
  events: number[];
  blockedUntil?: number;
  blockMessageSent?: boolean;
  blockCount: number;
}

const stateByTgId = new Map<number, UserFloodState>();
const BLOCK_MSG = "Вы заблокированы за спам. Обратитесь к админу @karikbol";

function prune(state: UserFloodState, now: number): void {
  const windowMs = config.flood.windowSec * 1000;
  state.events = state.events.filter((t) => now - t < windowMs);
}

function getState(tgId: number): UserFloodState {
  let s = stateByTgId.get(tgId);
  if (!s) {
    s = { events: [], blockCount: 0 };
    stateByTgId.set(tgId, s);
  }
  return s;
}

/**
 * Returns true if the user is allowed to proceed (not blocked).
 * When blocked: does not call next; bot must ACK update only (no reply).
 * When FLOOD_PROTECTION_ENABLED=false: only audit-logs flood_suspected, never blocks.
 */
export function checkFlood(tgId: number, now: number = Date.now()): {
  allowed: boolean;
  sendBlockMessage: boolean;
} {
  const state = getState(tgId);

  if (state.blockedUntil != null && now < state.blockedUntil) {
    return { allowed: false, sendBlockMessage: false };
  }

  if (state.blockedUntil != null && now >= state.blockedUntil) {
    state.blockedUntil = undefined;
    state.blockMessageSent = undefined;
  }

  prune(state, now);
  state.events.push(now);

  if (state.events.length <= config.flood.maxEvents) {
    return { allowed: true, sendBlockMessage: false };
  }

  if (!config.flood.enabled) {
    auditLog("flood_suspected", { tgId, meta: { events: state.events.length, windowSec: config.flood.windowSec } }).catch(() => {});
    logger.warn({ tgId, events: state.events.length }, "Flood suspected (audit only)");
    state.events = [];
    return { allowed: true, sendBlockMessage: false };
  }

  state.blockedUntil = now + config.flood.blockMin * 60 * 1000;
  state.blockCount += 1;
  const firstTimeThisBlock = state.blockMessageSent !== true;
  state.blockMessageSent = true;
  state.events = [];

  auditLog("flood_blocked", { tgId, meta: { blockCount: state.blockCount } }).catch(() => {});

  if (config.flood.hardBlockEnabled && state.blockCount >= 3) {
    auditLog("flood_hard_block_stub", { tgId, meta: { blockCount: state.blockCount } }).catch(() => {});
    logger.info({ tgId, blockCount: state.blockCount }, "Hard block stub (future: indefinite block in DB)");
  }

  return { allowed: false, sendBlockMessage: firstTimeThisBlock };
}

export function getBlockMessage(): string {
  return BLOCK_MSG;
}

const WINDOW_MS = 60 * 1000;
const GENERAL_LIMIT = 60;
const RECOVERY_LIMIT = 20;

interface Bucket {
  count: number;
  resetAt: number;
  recoveryCount: number;
  recoveryResetAt: number;
}

const buckets = new Map<number, Bucket>();

function getBucket(tgId: number): Bucket {
  let b = buckets.get(tgId);
  if (!b) {
    b = { count: 0, resetAt: 0, recoveryCount: 0, recoveryResetAt: 0 };
    buckets.set(tgId, b);
  }
  return b;
}

export function checkRateLimit(tgId: number, isRecovery: boolean): { allowed: boolean } {
  const now = Date.now();
  const b = getBucket(tgId);

  if (now >= b.resetAt) {
    b.count = 0;
    b.resetAt = now + WINDOW_MS;
  }
  if (now >= b.recoveryResetAt) {
    b.recoveryCount = 0;
    b.recoveryResetAt = now + WINDOW_MS;
  }

  if (isRecovery) {
    b.recoveryCount++;
    if (b.recoveryCount > RECOVERY_LIMIT) return { allowed: false };
  }
  b.count++;
  if (b.count > GENERAL_LIMIT) return { allowed: false };
  return { allowed: true };
}

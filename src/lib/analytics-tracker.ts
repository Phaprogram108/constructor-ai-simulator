// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = undefined;
let redisAvailable: boolean | null = null;

function getRedis() {
  if (redisAvailable !== null) return redisAvailable ? redisClient : null;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisAvailable = false;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({ url, token });
    redisAvailable = true;
    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

getRedis();

const ANALYTICS_TTL = 7_776_000; // 90 days in seconds

export interface DailyMetrics {
  date: string;
  sessions_created: number;
  chats_sent: number;
  session_errors: number;
  rate_limited: number;
}

const TRACKED_EVENTS = ['sessions_created', 'chats_sent', 'session_errors', 'rate_limited'] as const;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function analyticsKey(date: string, event: string): string {
  return `analytics:${date}:${event}`;
}

/**
 * Increment an analytics counter. Fire-and-forget — never blocks the request.
 * Uses INCR on analytics:YYYY-MM-DD:event_name and sets a 90-day TTL on first write.
 */
export function trackEvent(event: string): void {
  const redis = getRedis();
  if (!redis) return;

  const key = analyticsKey(todayUTC(), event);

  // Fire-and-forget: intentionally not awaited
  void (async () => {
    try {
      const newValue = await redis.incr(key);
      // Set TTL only on first write to avoid resetting expiry on every call
      if (newValue === 1) {
        await redis.expire(key, ANALYTICS_TTL);
      }
    } catch {
      // Never crash the request
    }
  })();
}

/**
 * Read all counters for a given date. Defaults to today (UTC).
 */
export async function getMetrics(date?: string): Promise<DailyMetrics> {
  const targetDate = date ?? todayUTC();
  const redis = getRedis();

  const metrics: DailyMetrics = {
    date: targetDate,
    sessions_created: 0,
    chats_sent: 0,
    session_errors: 0,
    rate_limited: 0,
  };

  if (!redis) return metrics;

  try {
    const keys = TRACKED_EVENTS.map(event => analyticsKey(targetDate, event));
    const values: (string | null)[] = await redis.mget(...keys);

    TRACKED_EVENTS.forEach((event, i) => {
      metrics[event] = parseInt(values[i] ?? '0', 10) || 0;
    });
  } catch {
    // Return zero-filled metrics on error
  }

  return metrics;
}

/**
 * Return metrics for the last N days (inclusive of today), ordered oldest-first.
 */
export async function getMetricsRange(days: number): Promise<DailyMetrics[]> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return Promise.all(dates.map(date => getMetrics(date)));
}

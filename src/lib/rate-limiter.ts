import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const RATE_LIMITS = {
  create: { windowMs: 60_000, max: 5 },
  chat: { windowMs: 60_000, max: 15 },
  research: { windowMs: 60_000, max: 5 },
} as const;

type Bucket = keyof typeof RATE_LIMITS;

const DAILY_LIMITS: Record<Bucket, number> = {
  create: 5,
  chat: 300,
  research: 50,
};

const WEEKLY_CHAT_LIMIT = 20;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60_000; // 7 days

const STRIKES_BEFORE_BAN = 3;
const STRIKE_WINDOW_MS = 10 * 60_000;
const BAN_DURATION_MS = 60 * 60_000;
const BAN_ESCALATED_MS = 24 * 60 * 60_000;

// Anti-bot: speed detection
const SPEED_THRESHOLD_COUNT = 5;
const SPEED_THRESHOLD_WINDOW_MS = 10_000; // 10 seconds

// Anti-bot: known bot User-Agents
const BOT_USER_AGENTS = [
  'curl', 'wget', 'python-requests', 'python-urllib',
  'go-http-client', 'java/', 'libwww-perl',
];

interface BanRecord {
  strikes: number;
  strikeWindowStart: number;
  bannedUntil: number;
  previousBan: boolean;
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const dailyCounts = new Map<string, { count: number; resetsAt: number }>();
const weeklyChatCounts = new Map<string, { count: number; resetsAt: number }>();
const speedTracking = new Map<string, number[]>(); // IP -> array of timestamps
const bans = new Map<string, BanRecord>();

let checksCounter = 0;

function getNextMidnightUTC(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

/**
 * Hash a User-Agent string into a short hex string for use as part of a key.
 */
function hashUserAgent(ua: string): string {
  return crypto.createHash('md5').update(ua).digest('hex').slice(0, 8);
}

/**
 * Build a fingerprint from IP + User-Agent hash for more robust rate limiting.
 */
export function getClientFingerprint(request: Request): string {
  const ip = getClientIp(request);
  const ua = request.headers.get('user-agent') || '';
  if (!ua) return ip;
  return `${ip}:${hashUserAgent(ua)}`;
}

/**
 * Extract raw IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

/**
 * Check if a request comes from a known bot based on User-Agent.
 * Returns true if the request should be blocked.
 */
export function isBot(request: Request): boolean {
  const ua = request.headers.get('user-agent');
  if (!ua) return true; // No User-Agent = block
  const uaLower = ua.toLowerCase();
  return BOT_USER_AGENTS.some(bot => uaLower.includes(bot));
}

/**
 * Check speed-based abuse: if an IP sends 5+ messages in <10 seconds, ban immediately.
 * Returns true if the IP should be banned.
 */
export function checkSpeedAbuse(identifier: string): boolean {
  const now = Date.now();
  let timestamps = speedTracking.get(identifier);

  if (!timestamps) {
    timestamps = [];
    speedTracking.set(identifier, timestamps);
  }

  // Remove old timestamps outside the window
  const cutoff = now - SPEED_THRESHOLD_WINDOW_MS;
  const filtered = timestamps.filter(t => t > cutoff);
  filtered.push(now);
  speedTracking.set(identifier, filtered);

  if (filtered.length >= SPEED_THRESHOLD_COUNT) {
    // Trigger immediate ban
    const banRecord = bans.get(identifier) || {
      strikes: 0, strikeWindowStart: now, bannedUntil: 0, previousBan: false,
    };
    const duration = banRecord.previousBan ? BAN_ESCALATED_MS : BAN_DURATION_MS;
    banRecord.bannedUntil = now + duration;
    banRecord.previousBan = true;
    bans.set(identifier, banRecord);

    const durationLabel = duration === BAN_DURATION_MS ? '1 hora' : '24 horas';
    void alertSlack(identifier, 'Speed abuse: 5+ msgs in <10s', durationLabel, 'speed');

    // Clear speed tracking after ban
    speedTracking.delete(identifier);
    return true;
  }

  return false;
}

function cleanupIfNeeded(): void {
  checksCounter++;
  if (checksCounter % 100 !== 0) return;

  const now = Date.now();

  for (const [k, record] of requestCounts) {
    if (now > record.resetAt) {
      requestCounts.delete(k);
    }
  }

  for (const [k, record] of dailyCounts) {
    if (now > record.resetsAt) {
      dailyCounts.delete(k);
    }
  }

  for (const [k, record] of weeklyChatCounts) {
    if (now > record.resetsAt) {
      weeklyChatCounts.delete(k);
    }
  }

  for (const [k, timestamps] of speedTracking) {
    const cutoff = now - SPEED_THRESHOLD_WINDOW_MS;
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) {
      speedTracking.delete(k);
    } else {
      speedTracking.set(k, filtered);
    }
  }

  for (const [k, record] of bans) {
    if (record.bannedUntil > 0 && now > record.bannedUntil && now > record.strikeWindowStart + STRIKE_WINDOW_MS) {
      bans.delete(k);
    }
  }
}

export function getClientIdentifier(request: Request): string {
  return getClientFingerprint(request);
}

export function checkRateLimit(
  identifier: string,
  bucket: Bucket = 'create'
): { allowed: boolean; remaining: number; banned?: boolean; dailyExceeded?: boolean } {
  const now = Date.now();
  cleanupIfNeeded();

  // 1. Check ban
  const banRecord = bans.get(identifier);
  if (banRecord && banRecord.bannedUntil > now) {
    return { allowed: false, remaining: 0, banned: true };
  }

  // 2. Check daily limit
  const dailyKey = `${bucket}:${identifier}`;
  const dailyRecord = dailyCounts.get(dailyKey);
  const dailyMax = DAILY_LIMITS[bucket];

  if (dailyRecord && now < dailyRecord.resetsAt) {
    if (dailyRecord.count >= dailyMax) {
      return { allowed: false, remaining: 0, dailyExceeded: true };
    }
  }

  // 3. Check per-minute rate limit
  const { windowMs, max } = RATE_LIMITS[bucket];
  const rateKey = `${bucket}:${identifier}`;
  const rateRecord = requestCounts.get(rateKey);

  if (rateRecord && now <= rateRecord.resetAt && rateRecord.count >= max) {
    recordStrike(identifier, bucket);
    return { allowed: false, remaining: 0 };
  }

  // Allowed - update counters
  if (!rateRecord || now > rateRecord.resetAt) {
    requestCounts.set(rateKey, { count: 1, resetAt: now + windowMs });
  } else {
    rateRecord.count++;
  }

  if (!dailyRecord || now >= dailyRecord.resetsAt) {
    dailyCounts.set(dailyKey, { count: 1, resetsAt: getNextMidnightUTC() });
  } else {
    dailyRecord.count++;
  }

  const currentRate = requestCounts.get(rateKey)!;
  return { allowed: true, remaining: max - currentRate.count };
}

/**
 * Check the weekly chat limit (20 messages per IP per 7 days).
 * This is separate from the per-minute/daily checks.
 */
export function checkWeeklyChatLimit(
  identifier: string
): { allowed: boolean; weeklyExceeded: boolean } {
  const now = Date.now();
  const weeklyKey = `weekly-chat:${identifier}`;
  const record = weeklyChatCounts.get(weeklyKey);

  if (record && now < record.resetsAt) {
    if (record.count >= WEEKLY_CHAT_LIMIT) {
      return { allowed: false, weeklyExceeded: true };
    }
    record.count++;
    return { allowed: true, weeklyExceeded: false };
  }

  // New window
  weeklyChatCounts.set(weeklyKey, { count: 1, resetsAt: now + WEEKLY_WINDOW_MS });
  return { allowed: true, weeklyExceeded: false };
}

function recordStrike(identifier: string, bucket: Bucket): void {
  const now = Date.now();
  let record = bans.get(identifier);

  if (!record) {
    record = { strikes: 0, strikeWindowStart: now, bannedUntil: 0, previousBan: false };
    bans.set(identifier, record);
  }

  if (now - record.strikeWindowStart > STRIKE_WINDOW_MS) {
    record.strikes = 0;
    record.strikeWindowStart = now;
  }

  record.strikes++;

  if (record.strikes >= STRIKES_BEFORE_BAN) {
    const wasBannedBefore = record.previousBan;
    const duration = wasBannedBefore ? BAN_ESCALATED_MS : BAN_DURATION_MS;
    record.bannedUntil = now + duration;
    record.previousBan = true;
    record.strikes = 0;

    const durationLabel = duration === BAN_DURATION_MS ? '1 hora' : '24 horas';
    const reason = wasBannedBefore ? 'Reincidencia en rate limit' : 'Strikes acumulados en rate limit';
    void alertSlack(identifier, reason, durationLabel, bucket);
  }
}

async function alertSlack(ip: string, reason: string, duration: string, bucket: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `\ud83d\udea8 *Constructor AI - Abuso detectado*\n\u2022 IP: \`${ip}\`\n\u2022 Endpoint: \`${bucket}\`\n\u2022 Raz\u00f3n: ${reason}\n\u2022 Baneado por: ${duration}`,
      }),
    });
  } catch {
    // Don't let alert failures affect the app
  }
}

export function rateLimit(request: Request, bucket: Bucket): NextResponse | null {
  if (process.env.NODE_ENV === 'development') return null;

  // Anti-bot: check User-Agent first (fail fast)
  if (isBot(request)) {
    return NextResponse.json(
      { error: 'Acceso no permitido.' },
      { status: 403 }
    );
  }

  const clientId = getClientIdentifier(request);

  // Anti-bot: speed abuse detection (uses IP for speed tracking)
  const ip = getClientIp(request);
  if (checkSpeedAbuse(ip)) {
    return NextResponse.json(
      { error: 'Acceso bloqueado temporalmente por uso excesivo.' },
      { status: 403 }
    );
  }

  const result = checkRateLimit(clientId, bucket);

  if (result.banned) {
    return NextResponse.json(
      { error: 'Acceso bloqueado temporalmente por uso excesivo.' },
      { status: 403 }
    );
  }

  if (result.dailyExceeded) {
    return NextResponse.json(
      { error: 'L\u00edmite diario alcanzado. Intent\u00e1 ma\u00f1ana.' },
      { status: 429 }
    );
  }

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intent\u00e1 de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  // Weekly chat limit (only for chat bucket)
  if (bucket === 'chat') {
    const weeklyResult = checkWeeklyChatLimit(ip);
    if (weeklyResult.weeklyExceeded) {
      return NextResponse.json(
        {
          error: 'Has alcanzado el l\u00edmite de testeo gratuito semanal (20 mensajes). Si quer\u00e9s un agente para tu empresa, contactanos.',
          code: 'CHAT_LIMIT_REACHED',
        },
        { status: 429 }
      );
    }
  }

  return null;
}

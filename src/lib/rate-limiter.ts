import { NextResponse } from 'next/server';

export const RATE_LIMITS = {
  create: { windowMs: 60_000, max: 5 },
  chat: { windowMs: 60_000, max: 15 },
  research: { windowMs: 60_000, max: 5 },
} as const;

type Bucket = keyof typeof RATE_LIMITS;

const DAILY_LIMITS: Record<Bucket, number> = {
  create: 20,
  chat: 300,
  research: 50,
};

const STRIKES_BEFORE_BAN = 3;
const STRIKE_WINDOW_MS = 10 * 60_000;
const BAN_DURATION_MS = 60 * 60_000;
const BAN_ESCALATED_MS = 24 * 60 * 60_000;

interface BanRecord {
  strikes: number;
  strikeWindowStart: number;
  bannedUntil: number;
  previousBan: boolean;
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const dailyCounts = new Map<string, { count: number; resetsAt: number }>();
const bans = new Map<string, BanRecord>();

let checksCounter = 0;

function getNextMidnightUTC(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
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

  for (const [k, record] of bans) {
    if (record.bannedUntil > 0 && now > record.bannedUntil && now > record.strikeWindowStart + STRIKE_WINDOW_MS) {
      bans.delete(k);
    }
  }
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return ip;
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
  const clientId = getClientIdentifier(request);
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

  return null;
}

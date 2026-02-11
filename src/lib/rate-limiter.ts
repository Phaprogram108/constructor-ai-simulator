import { NextResponse } from 'next/server';

export const RATE_LIMITS = {
  create: { windowMs: 60_000, max: 20 },
  chat: { windowMs: 60_000, max: 40 },
  research: { windowMs: 60_000, max: 10 },
} as const;

type Bucket = keyof typeof RATE_LIMITS;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(identifier: string, bucket: Bucket = 'create'): { allowed: boolean; remaining: number } {
  const { windowMs, max } = RATE_LIMITS[bucket];
  const key = `${bucket}:${identifier}`;
  const now = Date.now();
  const record = requestCounts.get(key);

  if (record && now > record.resetAt) {
    requestCounts.delete(key);
  }

  const currentRecord = requestCounts.get(key);

  if (!currentRecord) {
    requestCounts.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: max - 1 };
  }

  if (currentRecord.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  currentRecord.count++;
  return { allowed: true, remaining: max - currentRecord.count };
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return ip;
}

export function rateLimit(request: Request, bucket: Bucket): NextResponse | null {
  const clientId = getClientIdentifier(request);
  const result = checkRateLimit(clientId, bucket);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  return null;
}

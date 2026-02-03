// Simple in-memory rate limiter for MVP
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20;

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  // Clean old records
  if (record && now > record.resetAt) {
    requestCounts.delete(identifier);
  }

  const currentRecord = requestCounts.get(identifier);

  if (!currentRecord) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (currentRecord.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  currentRecord.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - currentRecord.count };
}

export function getClientIdentifier(request: Request): string {
  // For MVP, use IP from headers or fallback
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return ip;
}

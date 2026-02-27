import { v4 as uuidv4 } from 'uuid';
import { Session, Message } from '@/types';

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes in seconds
const DEFAULT_MAX_MESSAGES = 30;

// In-memory fallback for local development
const sessions = new Map<string, Session>();

// Redis client (lazy-initialized)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = undefined;
let redisAvailable: boolean | null = null; // null = not yet determined

function getRedis() {
  // Already initialized
  if (redisAvailable !== null) return redisAvailable ? redisClient : null;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('[session-manager] Redis env vars not set — using in-memory fallback');
    redisAvailable = false;
    return null;
  }

  try {
    // Dynamic require to avoid bundling issues when env vars are absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({ url, token });
    redisAvailable = true;
    console.log('[session-manager] Redis connected — sessions will persist across instances');
    return redisClient;
  } catch (err) {
    console.warn('[session-manager] Redis init failed, falling back to in-memory:', err);
    redisAvailable = false;
    return null;
  }
}

// Initialize once on module load
getRedis();

// ---- Serialization helpers ----

interface SerializedSession {
  id: string;
  companyName: string;
  systemPrompt: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string; // ISO string
  }>;
  messageCount: number;
  maxMessages: number;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
}

function serializeSession(session: Session): SerializedSession {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    messages: session.messages.map(m => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeSession(data: any): Session {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    expiresAt: new Date(data.expiresAt),
    messages: (data.messages || []).map((m: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  };
}

// ---- Public API (async, Redis-first with in-memory fallback) ----

export async function createSession(companyName: string, systemPrompt: string): Promise<Session> {
  const now = new Date();
  const session: Session = {
    id: uuidv4(),
    companyName,
    systemPrompt,
    messages: [],
    messageCount: 0,
    maxMessages: DEFAULT_MAX_MESSAGES,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  };

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`session:${session.id}`, serializeSession(session), { ex: SESSION_TTL_SECONDS });
    } catch (err) {
      console.warn('[session-manager] Redis set failed, storing in memory:', err);
      sessions.set(session.id, session);
    }
  } else {
    sessions.set(session.id, session);
    cleanupExpiredSessions();
  }

  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const redis = getRedis();

  if (redis) {
    try {
      const data = await redis.get(`session:${sessionId}`);
      if (!data) return null;

      const session = deserializeSession(data);

      // Check if session has expired
      if (new Date() > session.expiresAt) {
        await redis.del(`session:${sessionId}`);
        return null;
      }

      return session;
    } catch (err) {
      console.warn('[session-manager] Redis get failed, checking in-memory:', err);
      // Fall through to in-memory check
    }
  }

  // In-memory fallback
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export async function addMessage(sessionId: string, message: Message): Promise<boolean> {
  const redis = getRedis();

  if (redis) {
    try {
      const data = await redis.get(`session:${sessionId}`);
      if (!data) return false;

      const session = deserializeSession(data);

      if (session.messageCount >= session.maxMessages) return false;

      session.messages.push(message);
      if (message.role === 'user') {
        session.messageCount++;
      }

      // Extend session expiry on activity
      session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

      await redis.set(`session:${sessionId}`, serializeSession(session), { ex: SESSION_TTL_SECONDS });
      return true;
    } catch (err) {
      console.warn('[session-manager] Redis addMessage failed, trying in-memory:', err);
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.messageCount >= session.maxMessages) return false;

  session.messages.push(message);
  if (message.role === 'user') {
    session.messageCount++;
  }

  session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  return true;
}

export async function getMessagesRemaining(sessionId: string): Promise<number> {
  const session = await getSession(sessionId);
  if (!session) return 0;
  return session.maxMessages - session.messageCount;
}

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  const session = await getSession(sessionId);
  return session?.messages || [];
}

function cleanupExpiredSessions(): void {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
}

// For debugging
export function getActiveSessionCount(): number {
  if (redisAvailable) {
    // Redis TTL handles expiry; can't easily count keys
    return 0;
  }
  cleanupExpiredSessions();
  return sessions.size;
}

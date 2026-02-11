import { v4 as uuidv4 } from 'uuid';
import { Session, Message } from '@/types';

// In-memory storage for MVP
const sessions = new Map<string, Session>();

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_MESSAGES = 30;

export function createSession(companyName: string, systemPrompt: string): Session {
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

  sessions.set(session.id, session);
  cleanupExpiredSessions();

  return session;
}

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function addMessage(sessionId: string, message: Message): boolean {
  const session = sessions.get(sessionId);

  if (!session) {
    return false;
  }

  if (session.messageCount >= session.maxMessages) {
    return false;
  }

  session.messages.push(message);
  if (message.role === 'user') {
    session.messageCount++;
  }

  // Extend session expiry on activity
  session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  return true;
}

export function getMessagesRemaining(sessionId: string): number {
  const session = sessions.get(sessionId);
  if (!session) return 0;
  return session.maxMessages - session.messageCount;
}

export function getSessionMessages(sessionId: string): Message[] {
  const session = sessions.get(sessionId);
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
  cleanupExpiredSessions();
  return sessions.size;
}

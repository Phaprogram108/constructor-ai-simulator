export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  companyName: string;
  systemPrompt: string;
  messages: Message[];
  messageCount: number;
  maxMessages: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface ScrapedContent {
  title: string;
  description: string;
  services: string[];
  models: string[];
  contactInfo: string;
  rawText: string;
}

export interface CreateSessionRequest {
  websiteUrl: string;
  pdfUrl?: string;
  pdfBase64?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  companyName: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface ChatResponse {
  message: string;
  messagesRemaining: number;
}

export interface SessionInfo {
  id: string;
  companyName: string;
  messagesRemaining: number;
  expiresAt: Date;
}

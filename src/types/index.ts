export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Flags para analisis de calidad de respuestas
  flags?: {
    saidNoInfo?: boolean;           // Dijo "no tengo esa informacion"
    possibleHallucination?: boolean; // Validador detecto posible alucinacion
    validationConfidence?: number;   // Confianza del validador (0-1)
  };
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

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  linktree?: string;
  tiktok?: string;
  youtube?: string;
}

export interface ScrapedContent {
  title: string;
  description: string;
  services: string[];
  models: string[];
  contactInfo: string;
  rawText: string;
  faqs?: { question: string; answer: string }[];
  socialLinks?: SocialLinks;
  constructoraType?: 'modular' | 'tradicional' | 'mixta' | 'inmobiliaria';
}

export interface CreateSessionRequest {
  websiteUrl: string;
  pdfUrl?: string;
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

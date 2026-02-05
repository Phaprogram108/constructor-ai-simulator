/**
 * Enhanced Conversation Logger - Sistema de logging JSON estructurado
 *
 * Captura metadata del scraping, flags de validacion y calcula metricas de calidad.
 */

import fs from 'fs';
import path from 'path';
import { Message } from '@/types';
import { ValidationResult } from './response-validator';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ScrapingMetadata {
  method: 'firecrawl' | 'playwright' | 'fetch' | 'vision' | 'mixed';
  duration: number; // ms
  modelsFound: number;
  whatsappFound: boolean;
  instagramFound: boolean;
  linktreeExplored: boolean;
  pdfAnalyzed: boolean;
}

export interface EnhancedMessageFlags {
  saidNoInfo: boolean;
  possibleHallucination: boolean;
  validationConfidence?: number;
}

export interface EnhancedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  flags?: EnhancedMessageFlags;
}

export interface ConversationAnalysis {
  conversationQuality: number;  // 0-100
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  noInfoResponses: number;
  possibleHallucinations: number;
  issues: string[];
}

export interface EnhancedConversationLog {
  sessionId: string;
  companyName: string;
  companyUrl: string;
  constructoraType: 'modular' | 'tradicional' | 'mixta' | 'unknown';
  scraping: ScrapingMetadata;
  messages: EnhancedMessage[];
  analysis: ConversationAnalysis;
  createdAt: string;
  lastMessageAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LOGS_DIR = path.join(process.cwd(), 'logs', 'conversations');
const ENHANCED_LOGS_DIR = path.join(process.cwd(), 'logs', 'enhanced');

// In-memory cache for active sessions (para evitar leer/escribir en cada mensaje)
const activeLogs: Map<string, EnhancedConversationLog> = new Map();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function ensureLogsDirectory(dir: string = LOGS_DIR): void {
  // Skip en Vercel serverless (filesystem read-only)
  if (process.env.VERCEL) return;

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.warn('[Logger] Filesystem not available:', error);
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

// ============================================================================
// ENHANCED LOGGING FUNCTIONS
// ============================================================================

/**
 * Crear nuevo log cuando se inicia sesion
 */
export function createEnhancedLog(params: {
  sessionId: string;
  companyName: string;
  companyUrl: string;
  constructoraType?: 'modular' | 'tradicional' | 'mixta';
  scrapingMetadata: Partial<ScrapingMetadata>;
}): EnhancedConversationLog {
  const now = new Date().toISOString();

  const log: EnhancedConversationLog = {
    sessionId: params.sessionId,
    companyName: params.companyName,
    companyUrl: params.companyUrl,
    constructoraType: params.constructoraType || 'unknown',
    scraping: {
      method: params.scrapingMetadata.method || 'firecrawl',
      duration: params.scrapingMetadata.duration || 0,
      modelsFound: params.scrapingMetadata.modelsFound || 0,
      whatsappFound: params.scrapingMetadata.whatsappFound || false,
      instagramFound: params.scrapingMetadata.instagramFound || false,
      linktreeExplored: params.scrapingMetadata.linktreeExplored || false,
      pdfAnalyzed: params.scrapingMetadata.pdfAnalyzed || false,
    },
    messages: [],
    analysis: {
      conversationQuality: 100,
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      noInfoResponses: 0,
      possibleHallucinations: 0,
      issues: [],
    },
    createdAt: now,
    lastMessageAt: now,
  };

  // Guardar en cache
  activeLogs.set(params.sessionId, log);

  // Guardar a disco
  saveEnhancedLog(log);

  console.log(`[EnhancedLogger] Created log for session: ${params.sessionId}`);
  return log;
}

/**
 * Agregar mensaje al log existente
 */
export function appendEnhancedMessage(
  sessionId: string,
  message: Message,
  validationResult?: ValidationResult
): void {
  // Intentar obtener de cache o cargar de disco
  let log: EnhancedConversationLog | null | undefined = activeLogs.get(sessionId);

  if (!log) {
    const loadedLog = loadEnhancedLog(sessionId);
    if (loadedLog) {
      log = loadedLog;
      activeLogs.set(sessionId, loadedLog);
    }
  }

  if (!log) {
    console.warn(`[EnhancedLogger] No log found for session: ${sessionId}. Creating fallback.`);
    log = createEnhancedLog({
      sessionId,
      companyName: 'Unknown',
      companyUrl: '',
      scrapingMetadata: {},
    });
  }

  // Crear mensaje enhanced
  const enhancedMessage: EnhancedMessage = {
    role: message.role,
    content: message.content,
    timestamp: new Date().toISOString(),
  };

  // Agregar flags si es mensaje del asistente
  if (message.role === 'assistant') {
    const saidNoInfo = message.content.toLowerCase().includes('no tengo esa informacion') ||
                       message.content.toLowerCase().includes('no tengo información') ||
                       message.content.toLowerCase().includes('no cuento con esa información') ||
                       message.content.toLowerCase().includes('no dispongo de esa información');

    const possibleHallucination = validationResult ? !validationResult.isValid : false;

    enhancedMessage.flags = {
      saidNoInfo,
      possibleHallucination,
      validationConfidence: validationResult?.confidence,
    };

    // Actualizar contadores de analysis
    if (saidNoInfo) {
      log.analysis.noInfoResponses++;
    }
    if (possibleHallucination) {
      log.analysis.possibleHallucinations++;
    }
  }

  // Agregar mensaje
  log.messages.push(enhancedMessage);
  log.lastMessageAt = enhancedMessage.timestamp;

  // Actualizar contadores
  log.analysis.totalMessages = log.messages.length;
  log.analysis.userMessages = log.messages.filter(m => m.role === 'user').length;
  log.analysis.assistantMessages = log.messages.filter(m => m.role === 'assistant').length;

  // Recalcular calidad
  log.analysis.conversationQuality = calculateConversationQuality(log);
  log.analysis.issues = generateIssuesList(log);

  // Guardar actualizado
  saveEnhancedLog(log);
}

/**
 * Calcular calidad de conversacion (0-100)
 */
export function calculateConversationQuality(log: EnhancedConversationLog): number {
  let score = 100;

  // Penalizar por respuestas "no tengo info" (-15 c/u)
  score -= log.analysis.noInfoResponses * 15;

  // Penalizar por posibles alucinaciones (-20 c/u)
  score -= log.analysis.possibleHallucinations * 20;

  // Bonificar por conversacion larga (usuario enganchado)
  if (log.analysis.totalMessages >= 6) score += 5;
  if (log.analysis.totalMessages >= 10) score += 5;

  // Bonificar si tiene WhatsApp
  if (log.scraping.whatsappFound) score += 5;

  // Penalizar si no hay modelos
  if (log.scraping.modelsFound === 0) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generar lista de issues encontrados
 */
function generateIssuesList(log: EnhancedConversationLog): string[] {
  const issues: string[] = [];

  if (log.analysis.noInfoResponses > 0) {
    issues.push(`${log.analysis.noInfoResponses} respuesta(s) con "no tengo info"`);
  }

  if (log.analysis.possibleHallucinations > 0) {
    issues.push(`${log.analysis.possibleHallucinations} posible(s) alucinacion(es)`);
  }

  if (log.scraping.modelsFound === 0) {
    issues.push('No se encontraron modelos en el scraping');
  }

  if (!log.scraping.whatsappFound && !log.scraping.instagramFound) {
    issues.push('Sin datos de contacto social');
  }

  return issues;
}

/**
 * Guardar log a disco
 */
export function saveEnhancedLog(log: EnhancedConversationLog): string {
  // Skip en Vercel serverless (filesystem read-only)
  if (process.env.VERCEL) {
    return '';
  }

  try {
    ensureLogsDirectory(ENHANCED_LOGS_DIR);

    const filename = `${log.sessionId}.json`;
    const filepath = path.join(ENHANCED_LOGS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(log, null, 2), 'utf-8');

    return filepath;
  } catch (error) {
    console.warn('[Logger] Cannot save log to filesystem:', error);
    return '';
  }
}

/**
 * Cargar log por sessionId
 */
export function loadEnhancedLog(sessionId: string): EnhancedConversationLog | null {
  // Skip en Vercel serverless (filesystem read-only)
  if (process.env.VERCEL) {
    return null;
  }

  try {
    ensureLogsDirectory(ENHANCED_LOGS_DIR);

    const filepath = path.join(ENHANCED_LOGS_DIR, `${sessionId}.json`);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as EnhancedConversationLog;
  } catch (error) {
    console.warn(`[EnhancedLogger] Cannot load log: ${sessionId}`, error);
    return null;
  }
}

/**
 * Obtener log de cache o disco
 */
export function getLog(sessionId: string): EnhancedConversationLog | null {
  // Primero buscar en cache
  const cached = activeLogs.get(sessionId);
  if (cached) {
    return cached;
  }

  // Cargar de disco
  return loadEnhancedLog(sessionId);
}

/**
 * Finalizar y guardar log (llamar al terminar sesion)
 */
export function finalizeLog(sessionId: string): EnhancedConversationLog | null {
  const log = getLog(sessionId);

  if (!log) {
    return null;
  }

  // Recalcular todo
  log.analysis.conversationQuality = calculateConversationQuality(log);
  log.analysis.issues = generateIssuesList(log);

  // Guardar version final
  saveEnhancedLog(log);

  // Limpiar cache
  activeLogs.delete(sessionId);

  console.log(`[EnhancedLogger] Finalized log for session: ${sessionId}, quality: ${log.analysis.conversationQuality}`);

  return log;
}

/**
 * Listar todos los logs enhanced
 */
export function listEnhancedLogs(): EnhancedConversationLog[] {
  // Skip en Vercel serverless (filesystem read-only)
  if (process.env.VERCEL) {
    return [];
  }

  try {
    ensureLogsDirectory(ENHANCED_LOGS_DIR);

    const files = fs.readdirSync(ENHANCED_LOGS_DIR).filter(f => f.endsWith('.json'));
    const logs: EnhancedConversationLog[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(ENHANCED_LOGS_DIR, file), 'utf-8');
        logs.push(JSON.parse(content) as EnhancedConversationLog);
      } catch {
        // Skip invalid files
      }
    }

    // Ordenar por fecha de creacion (mas reciente primero)
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return logs;
  } catch (error) {
    console.warn('[Logger] Cannot list logs from filesystem:', error);
    return [];
  }
}

// ============================================================================
// LEGACY FUNCTIONS (backward compatibility)
// ============================================================================

/**
 * @deprecated Usar createEnhancedLog + appendEnhancedMessage
 */
export function logConversation(
  sessionId: string,
  companyName: string,
  messages: Message[]
): string {
  // Skip en Vercel serverless (filesystem read-only)
  if (process.env.VERCEL) {
    return '';
  }

  try {
    ensureLogsDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedCompanyName = sanitizeFilename(companyName);
    const filename = `${timestamp}_${sanitizedCompanyName}.txt`;
    const filepath = path.join(LOGS_DIR, filename);

    let content = `=== Conversacion: ${companyName} ===\n`;
    content += `Fecha: ${new Date().toISOString()}\n`;
    content += `Session ID: ${sessionId}\n`;
    content += `${'='.repeat(50)}\n\n`;

    for (const msg of messages) {
      const role = msg.role === 'user' ? 'USUARIO' : 'SOFIA';
      content += `[${role}]\n${msg.content}\n\n`;
    }

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`[Logger] Conversation saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    console.warn('[Logger] Cannot save conversation to filesystem:', error);
    return '';
  }
}

/**
 * @deprecated Usar appendEnhancedMessage
 */
export function appendMessageToLog(
  sessionId: string,
  companyName: string,
  message: Message
): void {
  // Skip en Vercel serverless (filesystem read-only)
  if (process.env.VERCEL) {
    return;
  }

  try {
    ensureLogsDirectory();

    const files = fs.existsSync(LOGS_DIR) ? fs.readdirSync(LOGS_DIR) : [];
    const existingFile = files.find(f => f.includes(sessionId));

    if (existingFile) {
      const filepath = path.join(LOGS_DIR, existingFile);
      const role = message.role === 'user' ? 'USUARIO' : 'SOFIA';
      const content = `[${role}]\n${message.content}\n\n`;
      fs.appendFileSync(filepath, content, 'utf-8');
    } else {
      logConversation(sessionId, companyName, [message]);
    }
  } catch (error) {
    console.warn('[Logger] Cannot append message to filesystem:', error);
  }
}

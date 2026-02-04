import fs from 'fs';
import path from 'path';
import { Message } from '@/types';

const LOGS_DIR = path.join(process.cwd(), 'logs', 'conversations');

// Crear directorio si no existe
function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

export function logConversation(
  sessionId: string,
  companyName: string,
  messages: Message[]
): string {
  ensureLogsDirectory();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
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
}

export function appendMessageToLog(
  sessionId: string,
  companyName: string,
  message: Message
): void {
  ensureLogsDirectory();

  // Find existing file or create new one
  const files = fs.existsSync(LOGS_DIR) ? fs.readdirSync(LOGS_DIR) : [];
  const existingFile = files.find(f => f.includes(sessionId));

  if (existingFile) {
    const filepath = path.join(LOGS_DIR, existingFile);
    const role = message.role === 'user' ? 'USUARIO' : 'SOFIA';
    const content = `[${role}]\n${message.content}\n\n`;
    fs.appendFileSync(filepath, content, 'utf-8');
  } else {
    // Create new file with just this message
    logConversation(sessionId, companyName, [message]);
  }
}

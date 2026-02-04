import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'docs/conversaciones-completas');

// Preguntas base para empresas con catalogo
const BASE_QUESTIONS = [
  "Que modelos tienen?",
  "Cuanto cuesta el modelo mas chico?",
  "Construyen en [UBICACION]?",
  "Que incluye el precio?",
  "Tienen financiamiento?",
  "Quiero una casa de 2 dormitorios, que me recomiendan?"
];

// Preguntas para empresas sin catalogo fijo (diseno personalizado)
const CUSTOM_DESIGN_QUESTIONS = [
  "Como es el proceso de diseno?",
  "Cuanto cuesta aproximadamente el m2?",
  "Cuanto tiempo tarda una casa de 60m2?",
  "Que incluye el precio llave en mano?",
  "Tienen financiamiento?"
];

interface CompanyInfo {
  name: string;
  url: string;
  country: 'chile' | 'mexico' | 'argentina';
}

interface SessionResponse {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  messagesRemaining: number;
  systemPrompt: string;
  error?: string;
}

interface ChatResponse {
  message: string;
  error?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Analizar si la empresa tiene catalogo fijo o es diseno personalizado
function analyzeCompanyType(sessionData: SessionResponse): 'catalog' | 'custom' {
  const prompt = (sessionData.systemPrompt || '').toLowerCase();

  // Patrones que indican diseno personalizado
  const customPatterns = [
    'diseno personalizado',
    'a medida',
    'custom',
    'disenamos segun',
    'no manejamos catalogo',
    'cada proyecto es unico',
    'sin catalogo'
  ];

  const isCustom = customPatterns.some(p => prompt.includes(p));

  // Si el prompt menciona modelos especificos, es tipo catalogo
  const hasModels = /casa\s+\w+\s*[-:]\s*\d+\s*m/i.test(prompt) ||
                    /modelo\s+\w+/i.test(prompt);

  if (isCustom && !hasModels) return 'custom';
  return 'catalog';
}

// Adaptar preguntas segun tipo de empresa y pais
function adaptQuestions(companyType: 'catalog' | 'custom', country: string): string[] {
  const location = country === 'chile' ? 'Santiago' :
                   country === 'mexico' ? 'Ciudad de Mexico' : 'Buenos Aires';

  const questions = companyType === 'custom' ? CUSTOM_DESIGN_QUESTIONS : BASE_QUESTIONS;

  return questions.map(q => q.replace('[UBICACION]', location));
}

// Crear sesion via API
async function createSession(url: string): Promise<SessionResponse> {
  const response = await fetch('http://localhost:3000/api/simulator/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteUrl: url })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error creando sesion: ${response.status} - ${error}`);
  }

  return response.json();
}

// Llamar al API de chat
async function callChatAPI(
  sessionId: string,
  systemPrompt: string,
  message: string,
  history: ConversationMessage[],
  companyName: string
): Promise<string> {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message,
      systemPrompt,
      conversationHistory: history,
      companyName
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error en chat: ${response.status} - ${error}`);
  }

  const data: ChatResponse = await response.json();
  return data.message || 'Error en respuesta';
}

// Simular conversacion completa
async function simulateChat(
  session: SessionResponse,
  questions: string[]
): Promise<ConversationMessage[]> {
  const conversation: ConversationMessage[] = [];

  // Agregar mensaje de bienvenida
  if (session.welcomeMessage) {
    conversation.push({
      role: 'assistant',
      content: session.welcomeMessage
    });
  }

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`   [${i+1}/${questions.length}] Usuario: ${question.substring(0, 40)}...`);

    conversation.push({ role: 'user', content: question });

    try {
      const response = await callChatAPI(
        session.sessionId,
        session.systemPrompt,
        question,
        conversation.slice(0, -1), // Historia sin el mensaje actual
        session.companyName
      );

      conversation.push({ role: 'assistant', content: response });
      console.log(`   [${i+1}/${questions.length}] Sofia: ${response.substring(0, 50)}...`);
    } catch (error) {
      console.error(`   [${i+1}/${questions.length}] Error: ${error}`);
      conversation.push({ role: 'assistant', content: `[ERROR: ${error}]` });
    }

    // Esperar entre mensajes para no saturar
    await new Promise(r => setTimeout(r, 2000));
  }

  return conversation;
}

// Guardar conversacion a archivo
function saveConversation(
  company: CompanyInfo,
  conversation: ConversationMessage[],
  session: SessionResponse,
  companyType: string
): string {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = company.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const filename = `${timestamp}_${safeName}.txt`;
  const filepath = path.join(OUTPUT_DIR, filename);

  let content = '';
  content += '='.repeat(80) + '\n';
  content += `EMPRESA: ${company.name.toUpperCase()}\n`;
  content += '='.repeat(80) + '\n';
  content += `URL: ${company.url}\n`;
  content += `Pais: ${company.country}\n`;
  content += `Tipo detectado: ${companyType}\n`;
  content += `Fecha: ${new Date().toISOString()}\n`;
  content += `SessionId: ${session.sessionId}\n`;
  content += `Nombre detectado: ${session.companyName}\n`;
  content += '='.repeat(80) + '\n\n';

  content += 'CONVERSACION COMPLETA:\n';
  content += '='.repeat(80) + '\n\n';

  conversation.forEach(msg => {
    const label = msg.role === 'user' ? '[USUARIO]' : '[SOFIA]';
    content += `${label}\n${msg.content}\n\n`;
  });

  content += '='.repeat(80) + '\n';
  content += 'FIN DE CONVERSACION\n';
  content += '='.repeat(80) + '\n';

  // Agregar extracto del system prompt para debugging
  content += '\n\nSYSTEM PROMPT (primeros 2000 chars):\n';
  content += '-'.repeat(40) + '\n';
  content += session.systemPrompt.substring(0, 2000);
  if (session.systemPrompt.length > 2000) {
    content += '\n[... truncado ...]\n';
  }

  fs.writeFileSync(filepath, content);
  return filepath;
}

// Funcion principal para testear una empresa
export async function testCompanyFull(company: CompanyInfo): Promise<{
  success: boolean;
  filepath?: string;
  error?: string;
  companyType: string;
  messagesCount: number;
}> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${company.name}`);
  console.log(`URL: ${company.url}`);
  console.log('='.repeat(60));

  try {
    // 1. Crear sesion (esto hace el scraping)
    console.log('\n1. Creando sesion y scrapeando...');
    const session = await createSession(company.url);

    if (!session.sessionId) {
      throw new Error(session.error || 'No se pudo crear la sesion');
    }

    console.log(`   SessionId: ${session.sessionId}`);
    console.log(`   Empresa: ${session.companyName}`);
    console.log(`   Mensaje bienvenida: ${session.welcomeMessage.substring(0, 50)}...`);

    // 2. Analizar tipo de empresa
    console.log('\n2. Analizando tipo de empresa...');
    const companyType = analyzeCompanyType(session);
    console.log(`   Tipo: ${companyType}`);

    // 3. Adaptar preguntas
    console.log('\n3. Adaptando preguntas...');
    const questions = adaptQuestions(companyType, company.country);
    console.log(`   Preguntas: ${questions.length}`);
    questions.forEach((q, i) => console.log(`   ${i+1}. ${q}`));

    // 4. Ejecutar conversacion
    console.log('\n4. Ejecutando conversacion...');
    const conversation = await simulateChat(session, questions);
    console.log(`   Mensajes totales: ${conversation.length}`);

    // 5. Guardar
    console.log('\n5. Guardando conversacion...');
    const filepath = saveConversation(company, conversation, session, companyType);
    console.log(`   Archivo: ${filepath}`);

    return {
      success: true,
      filepath,
      companyType,
      messagesCount: conversation.length
    };

  } catch (error) {
    console.error(`\nError: ${error}`);
    return {
      success: false,
      error: String(error),
      companyType: 'unknown',
      messagesCount: 0
    };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Uso: npx tsx scripts/test-company-full.ts <nombre> <url> <pais>');
    console.log('');
    console.log('Ejemplos:');
    console.log('  npx tsx scripts/test-company-full.ts "LinkHome" "https://linkhome.cl" "chile"');
    console.log('  npx tsx scripts/test-company-full.ts "Casas Vema" "https://casasvema.com" "mexico"');
    console.log('  npx tsx scripts/test-company-full.ts "Ecomod" "https://ecomod.com.ar" "argentina"');
    console.log('');
    console.log('Paises soportados: chile, mexico, argentina');
    process.exit(1);
  }

  const [name, url, country] = args;

  if (!['chile', 'mexico', 'argentina'].includes(country)) {
    console.error('Error: Pais debe ser chile, mexico o argentina');
    process.exit(1);
  }

  const result = await testCompanyFull({
    name,
    url,
    country: country as 'chile' | 'mexico' | 'argentina'
  });

  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO:', result.success ? 'EXITOSO' : 'FALLIDO');
  console.log('Tipo empresa:', result.companyType);
  console.log('Mensajes:', result.messagesCount);
  if (result.filepath) console.log('Archivo:', result.filepath);
  if (result.error) console.log('Error:', result.error);
  console.log('='.repeat(60));
}

main().catch(console.error);

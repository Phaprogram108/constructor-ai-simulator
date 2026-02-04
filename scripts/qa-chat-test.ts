/**
 * Script 2: QA Chat Test
 * Ejecuta preguntas de prueba contra el simulador y guarda las respuestas
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '/tmp/qa-results';
const API_BASE = 'http://localhost:3000';

interface Empresa {
  name: string;
  url: string;
}

const EMPRESAS: Empresa[] = [
  { name: "Habika", url: "https://habika.ar/" },
  { name: "Ecomod", url: "https://ecomod.com.ar/" },
  { name: "Lista", url: "https://lista.com.ar/" },
  { name: "LucysHouse", url: "https://www.lucyshousearg.com/" },
  { name: "Arcohouse", url: "https://arcohouse.com.ar/" },
  { name: "T1Modular", url: "https://www.t1modular.com.ar/" },
  { name: "GoHome", url: "https://gohomeconstrucciones.com.ar/" },
  { name: "MiniCasas", url: "https://www.minicasas.com.ar/" },
  { name: "SmartPod", url: "https://www.smartpod.mx/" },
  { name: "Wellmod", url: "https://www.wellmod.com.ar/" }
];

// Preguntas de prueba estándar
const TEST_QUESTIONS = [
  {
    id: 'modelos',
    question: '¿Qué modelos de casas tienen?',
    category: 'catalogo'
  },
  {
    id: 'precio_economico',
    question: '¿Cuánto cuesta el modelo más económico?',
    category: 'precios'
  },
  {
    id: 'cobertura_pais',
    question: '¿Hacen envío a todo el país?',
    category: 'cobertura'
  },
  {
    id: 'cobertura_ciudad',
    question: '¿Llegan a Mar del Plata?',
    category: 'cobertura'
  },
  {
    id: 'financiacion',
    question: '¿Tienen financiación?',
    category: 'pagos'
  },
  {
    id: 'tiempo_construccion',
    question: '¿Cuánto tiempo tarda la construcción?',
    category: 'proceso'
  },
  {
    id: 'incluye_precio',
    question: '¿Qué incluye el precio?',
    category: 'precios'
  }
];

interface SessionResponse {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  messagesRemaining: number;
  systemPrompt: string;
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QuestionResult {
  id: string;
  question: string;
  category: string;
  response: string;
  timestamp: string;
  error?: string;
}

interface TestResult {
  empresa: string;
  url: string;
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  timestamp: string;
  duration: number;
  questions: QuestionResult[];
  systemPromptExcerpt: string;
}

async function createSession(url: string): Promise<SessionResponse> {
  console.log(`  Creando sesion para ${url}...`);

  const response = await fetch(`${API_BASE}/api/simulator/create`, {
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

async function sendMessage(
  sessionId: string,
  systemPrompt: string,
  message: string,
  history: ChatMessage[],
  companyName: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/chat`, {
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

  const data = await response.json();
  return data.message || '[Sin respuesta]';
}

async function testEmpresa(empresa: Empresa): Promise<TestResult> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${empresa.name}`);
  console.log(`URL: ${empresa.url}`);
  console.log('='.repeat(50));

  // 1. Crear sesion
  const session = await createSession(empresa.url);

  if (!session.sessionId) {
    throw new Error(session.error || 'No se pudo crear la sesion');
  }

  console.log(`  SessionId: ${session.sessionId}`);
  console.log(`  Empresa detectada: ${session.companyName}`);

  // 2. Ejecutar preguntas
  const conversationHistory: ChatMessage[] = [];
  const questionResults: QuestionResult[] = [];

  // Agregar welcome message al historial
  if (session.welcomeMessage) {
    conversationHistory.push({
      role: 'assistant',
      content: session.welcomeMessage
    });
  }

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const q = TEST_QUESTIONS[i];
    console.log(`\n  [${i+1}/${TEST_QUESTIONS.length}] ${q.question}`);

    try {
      // Agregar pregunta al historial
      conversationHistory.push({
        role: 'user',
        content: q.question
      });

      // Enviar mensaje (sin incluir la pregunta actual en el historial)
      const response = await sendMessage(
        session.sessionId,
        session.systemPrompt,
        q.question,
        conversationHistory.slice(0, -1),
        session.companyName
      );

      // Agregar respuesta al historial
      conversationHistory.push({
        role: 'assistant',
        content: response
      });

      questionResults.push({
        id: q.id,
        question: q.question,
        category: q.category,
        response: response,
        timestamp: new Date().toISOString()
      });

      console.log(`    -> ${response.substring(0, 100)}...`);

      // Esperar entre preguntas para no saturar
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      console.error(`    -> ERROR: ${error}`);

      questionResults.push({
        id: q.id,
        question: q.question,
        category: q.category,
        response: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const duration = Date.now() - startTime;

  return {
    empresa: empresa.name,
    url: empresa.url,
    sessionId: session.sessionId,
    companyName: session.companyName,
    welcomeMessage: session.welcomeMessage,
    timestamp: new Date().toISOString(),
    duration,
    questions: questionResults,
    systemPromptExcerpt: session.systemPrompt.substring(0, 3000)
  };
}

export async function runChatTests(empresas: Empresa[] = EMPRESAS): Promise<TestResult[]> {
  console.log('='.repeat(60));
  console.log('QA CHAT TEST');
  console.log(`Testeando ${empresas.length} empresas`);
  console.log(`Preguntas por empresa: ${TEST_QUESTIONS.length}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Crear directorio
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results: TestResult[] = [];

  for (const empresa of empresas) {
    try {
      const result = await testEmpresa(empresa);
      results.push(result);

      // Guardar resultado individual
      const filepath = path.join(OUTPUT_DIR, `${empresa.name}.json`);
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      console.log(`\n  Guardado: ${filepath}`);

    } catch (error) {
      console.error(`\nError testeando ${empresa.name}:`, error);

      // Guardar error
      const errorResult: TestResult = {
        empresa: empresa.name,
        url: empresa.url,
        sessionId: '',
        companyName: '',
        welcomeMessage: '',
        timestamp: new Date().toISOString(),
        duration: 0,
        questions: [],
        systemPromptExcerpt: `ERROR: ${error instanceof Error ? error.message : String(error)}`
      };

      const filepath = path.join(OUTPUT_DIR, `${empresa.name}.json`);
      fs.writeFileSync(filepath, JSON.stringify(errorResult, null, 2));
      results.push(errorResult);
    }
  }

  // Guardar resumen
  const summaryPath = path.join(OUTPUT_DIR, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    empresasTesteadas: results.length,
    questionsPerEmpresa: TEST_QUESTIONS.length,
    results: results.map(r => ({
      empresa: r.empresa,
      sessionId: r.sessionId,
      questionsAnswered: r.questions.filter(q => !q.error).length,
      duration: r.duration
    }))
  }, null, 2));

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE TESTS');
  console.log('='.repeat(60));

  for (const result of results) {
    const answered = result.questions.filter(q => !q.error).length;
    const total = result.questions.length || TEST_QUESTIONS.length;
    const status = result.sessionId ? 'OK' : 'ERROR';
    console.log(`${result.empresa}: ${status} - ${answered}/${total} preguntas respondidas (${(result.duration/1000).toFixed(1)}s)`);
  }

  const totalAnswered = results.reduce((acc, r) => acc + r.questions.filter(q => !q.error).length, 0);
  const totalQuestions = results.length * TEST_QUESTIONS.length;
  console.log(`\nTotal: ${totalAnswered}/${totalQuestions} preguntas respondidas`);

  return results;
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  let empresasToTest = EMPRESAS;

  // Si se pasa un argumento, filtrar por nombre
  if (args.length > 0) {
    const filter = args[0].toLowerCase();
    empresasToTest = EMPRESAS.filter(e => e.name.toLowerCase().includes(filter));

    if (empresasToTest.length === 0) {
      console.error(`No se encontraron empresas que coincidan con: ${args[0]}`);
      console.log('Empresas disponibles:', EMPRESAS.map(e => e.name).join(', '));
      process.exit(1);
    }
  }

  await runChatTests(empresasToTest);
}

main().catch(console.error);

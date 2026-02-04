// Test script for batch 1 - 8 companies
import fs from 'fs';

const EMPRESAS = [
  'https://ecomod.com.ar/',
  'https://lista.com.ar/',
  'https://movilhauss.com',
  'https://www.plugarq.com/',
  'https://habika.ar/',
  'https://arcohouse.com.ar/',
  'https://atlashousing.com.ar/',
  'https://www.lucyshousearg.com/'
];

const PREGUNTAS = [
  '¿Qué modelos tienen?',
  '¿Cuánto cuesta el modelo más chico?'
];

async function createSession(websiteUrl) {
  const res = await fetch('http://localhost:3000/api/simulator/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteUrl })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session: ${res.status} - ${text}`);
  }

  return res.json();
}

async function sendMessage(sessionId, message, systemPrompt, conversationHistory, companyName) {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message,
      systemPrompt,
      conversationHistory,
      companyName
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send message: ${res.status} - ${text}`);
  }

  return res.json();
}

function evaluateResponse(response, question) {
  // Evaluar si la respuesta es ESPECIFICA o GENERICA
  const responseText = response.toLowerCase();

  // Indicadores de respuesta generica
  const genericIndicators = [
    'no tengo información',
    'no cuento con información',
    'te recomiendo contactar',
    'contactar directamente',
    'visita el sitio web',
    'no puedo proporcionarte',
    'no tengo datos',
    'no dispongo de',
    'no cuento con datos específicos',
    'consulta el sitio',
    'te sugiero visitar'
  ];

  // Indicadores de respuesta especifica
  const specificIndicators = {
    modelos: ['modelo', 'casa', 'vivienda', 'm2', 'm²', 'metros', 'dormitorio', 'habitacion', 'ambiente'],
    precios: ['$', 'usd', 'dolar', 'peso', 'precio', 'costo', 'valor', 'cotización']
  };

  const isGeneric = genericIndicators.some(ind => responseText.includes(ind));

  let hasSpecificContent = false;
  if (question.includes('modelos')) {
    hasSpecificContent = specificIndicators.modelos.some(ind => responseText.includes(ind));
  } else if (question.includes('cuesta') || question.includes('precio')) {
    hasSpecificContent = specificIndicators.precios.some(ind => responseText.includes(ind));
  }

  return {
    isSpecific: hasSpecificContent && !isGeneric,
    isGeneric: isGeneric,
    // PASS si tiene contenido específico SIN indicadores genericos
    pass: hasSpecificContent && !isGeneric
  };
}

async function testCompany(url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${url}`);
  console.log('='.repeat(60));

  const result = {
    url,
    companyName: '',
    success: false,
    responses: [],
    modelos: '',
    precios: '',
    modelosEspecifico: false,
    preciosEspecifico: false,
    pass: false,
    error: null
  };

  try {
    // 1. Create session
    console.log('Creating session...');
    const session = await createSession(url);
    result.companyName = session.companyName;
    result.sessionId = session.sessionId;
    console.log(`Session created: ${session.companyName}`);

    // Conversation history
    let conversationHistory = [];

    // 2. Ask questions
    for (const pregunta of PREGUNTAS) {
      console.log(`\nPreguntando: ${pregunta}`);

      const chatResponse = await sendMessage(
        session.sessionId,
        pregunta,
        session.systemPrompt,
        conversationHistory,
        session.companyName
      );

      const respuesta = chatResponse.message;
      console.log(`Respuesta: ${respuesta.substring(0, 200)}...`);

      // Add to history
      conversationHistory.push({ role: 'user', content: pregunta });
      conversationHistory.push({ role: 'assistant', content: respuesta });

      // Evaluate
      const evaluation = evaluateResponse(respuesta, pregunta);

      if (pregunta.includes('modelos')) {
        result.modelos = respuesta;
        result.modelosEspecifico = evaluation.pass;
        console.log(`Evaluación modelos: ${evaluation.pass ? 'ESPECÍFICO' : 'GENÉRICO'}`);
      } else if (pregunta.includes('cuesta')) {
        result.precios = respuesta;
        result.preciosEspecifico = evaluation.pass;
        console.log(`Evaluación precios: ${evaluation.pass ? 'ESPECÍFICO' : 'GENÉRICO'}`);
      }

      result.responses.push({
        question: pregunta,
        answer: respuesta,
        evaluation
      });

      // Small delay between questions
      await new Promise(r => setTimeout(r, 1000));
    }

    // Overall pass if both are specific
    result.pass = result.modelosEspecifico && result.preciosEspecifico;
    result.success = true;

  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    result.error = error.message;
  }

  return result;
}

async function main() {
  console.log('Starting Batch 1 Tests - 8 Companies');
  console.log(`Date: ${new Date().toISOString()}`);

  const results = [];

  for (const url of EMPRESAS) {
    const result = await testCompany(url);
    results.push(result);

    // Delay between companies to avoid rate limiting
    console.log('\nWaiting 2 seconds before next company...');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Print summary table
  console.log('\n\n');
  console.log('='.repeat(100));
  console.log('RESUMEN DE RESULTADOS - BATCH 1');
  console.log('='.repeat(100));

  console.log('\n| Empresa | Modelos Extraídos | Precios | Específico | Pass/Fail |');
  console.log('|---------|-------------------|---------|------------|-----------|');

  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const modelosShort = r.modelos ? r.modelos.substring(0, 50).replace(/\n/g, ' ') + '...' : 'ERROR';
    const preciosShort = r.precios ? (r.precios.substring(0, 30).replace(/\n/g, ' ') + '...') : 'N/A';
    const especifico = r.modelosEspecifico && r.preciosEspecifico ? 'SI' : 'NO';
    const passStatus = r.pass ? 'PASS' : 'FAIL';

    if (r.pass) passCount++;
    else failCount++;

    console.log(`| ${r.companyName || r.url.substring(0, 20)} | ${modelosShort} | ${preciosShort} | ${especifico} | ${passStatus} |`);
  }

  console.log('\n');
  console.log(`TOTAL: ${passCount} PASS / ${failCount} FAIL`);

  // Save detailed results
  const outputPath = '/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/test-results/batch-1-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResultados guardados en: ${outputPath}`);

  return { results, passCount, failCount };
}

main().catch(console.error);

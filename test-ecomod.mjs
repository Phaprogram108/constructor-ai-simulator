// Test script for ecomod.com.ar only
import fs from 'fs';

async function createSession(websiteUrl) {
  const res = await fetch('http://localhost:3000/api/simulator/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteUrl })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session: ${res.status} - ${text.substring(0, 500)}`);
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
    throw new Error(`Failed to send message: ${res.status} - ${text.substring(0, 500)}`);
  }

  return res.json();
}

async function main() {
  console.log('Testing ecomod.com.ar...\n');

  try {
    // 1. Create session
    console.log('Creating session...');
    const session = await createSession('https://ecomod.com.ar/');
    console.log(`Session created: ${session.companyName}`);
    console.log(`Session ID: ${session.sessionId}`);

    let conversationHistory = [];

    // 2. Ask about models
    console.log('\nPreguntando: ¿Qué modelos tienen?');
    const modelsResponse = await sendMessage(
      session.sessionId,
      '¿Qué modelos tienen?',
      session.systemPrompt,
      conversationHistory,
      session.companyName
    );
    console.log(`Respuesta: ${modelsResponse.message}\n`);

    conversationHistory.push({ role: 'user', content: '¿Qué modelos tienen?' });
    conversationHistory.push({ role: 'assistant', content: modelsResponse.message });

    // 3. Ask about price
    console.log('Preguntando: ¿Cuánto cuesta el modelo más chico?');
    const priceResponse = await sendMessage(
      session.sessionId,
      '¿Cuánto cuesta el modelo más chico?',
      session.systemPrompt,
      conversationHistory,
      session.companyName
    );
    console.log(`Respuesta: ${priceResponse.message}\n`);

    // Evaluate
    const hasModels = modelsResponse.message.toLowerCase().includes('modelo') ||
                      modelsResponse.message.toLowerCase().includes('m2') ||
                      modelsResponse.message.toLowerCase().includes('m²');
    const hasPrice = priceResponse.message.toLowerCase().includes('$') ||
                     priceResponse.message.toLowerCase().includes('usd') ||
                     priceResponse.message.toLowerCase().includes('precio');
    const isGeneric = priceResponse.message.toLowerCase().includes('no tengo') ||
                      priceResponse.message.toLowerCase().includes('contactar');

    console.log('='.repeat(60));
    console.log('EVALUACION ECOMOD');
    console.log('='.repeat(60));
    console.log(`Empresa: ${session.companyName}`);
    console.log(`Tiene modelos: ${hasModels ? 'SI' : 'NO'}`);
    console.log(`Tiene precios: ${hasPrice ? 'SI' : 'NO'}`);
    console.log(`Es genérico: ${isGeneric ? 'SI' : 'NO'}`);
    console.log(`RESULTADO: ${hasModels && hasPrice && !isGeneric ? 'PASS' : 'FAIL'}`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

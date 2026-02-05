/**
 * Test QA de 20 empresas - Análisis profundo
 * Verifica: modelos, precios, contacto, FAQ, información técnica
 */

const EMPRESAS = [
  { name: "Ecomod", url: "https://ecomod.com.ar/" },
  { name: "Lista", url: "https://lista.com.ar/" },
  { name: "Movilhauss", url: "https://movilhauss.com" },
  { name: "PlugArq", url: "https://www.plugarq.com/" },
  { name: "Habika", url: "https://habika.ar/" },
  { name: "Arcohouse", url: "https://arcohouse.com.ar/" },
  { name: "Atlas Housing", url: "https://atlashousing.com.ar/" },
  { name: "Lucys House", url: "https://www.lucyshousearg.com/" },
  { name: "Sienna Modular", url: "https://www.siennamodular.com.ar/" },
  { name: "Offis", url: "https://www.offis.ar/" },
  { name: "Efede", url: "https://efede.com.ar/casas-modulares/" },
  { name: "Mini Casas", url: "https://www.minicasas.com.ar/" },
  { name: "Wellmod", url: "https://www.wellmod.com.ar/" },
  { name: "Grupo Steimberg", url: "https://www.gruposteimberg.com/" },
  { name: "Aftamantes", url: "https://aftamantes.net/refugios/" },
  { name: "Arqtainer", url: "https://arqtainer.com.ar/" },
  { name: "T1 Modular", url: "https://www.t1modular.com.ar/" },
  { name: "GoHome", url: "https://gohomeconstrucciones.com.ar/" },
  { name: "Boxer Containers", url: "https://www.boxercontainers.com.ar/" },
  { name: "Promet Chile", url: "https://www.promet.cl/promet-habitacional/" },
];

// Preguntas clave para verificar calidad del scraping
const PREGUNTAS = [
  { key: "modelos", text: "¿Qué modelos de casas tienen disponibles? Dame los nombres y metros cuadrados." },
  { key: "precios", text: "¿Cuánto cuesta el modelo más económico y el más caro?" },
  { key: "contacto", text: "¿Cuál es el número de WhatsApp para contactarlos?" },
  { key: "cobertura", text: "¿Llegan a todo el país o solo a ciertas zonas?" },
  { key: "tecnico", text: "¿De qué materiales están hechas las casas? ¿Tienen DVH?" },
];

interface ConversationResult {
  empresa: string;
  url: string;
  sessionId: string;
  scrapingTime: number;
  status: "OK" | "ERROR";
  error?: string;
  welcomeMessage?: string;
  respuestas: {
    pregunta: string;
    respuesta: string;
    tieneInfoEspecifica: boolean;
    pareceInventado: boolean;
    redFlags: string[];
  }[];
  metricas: {
    totalPreguntas: number;
    respuestasEspecificas: number;
    respuestasDudosas: number;
    score: number;
  };
}

interface SimulatorSession {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  systemPrompt: string;
  scrapingTime: number;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}

async function createSimulator(websiteUrl: string): Promise<SimulatorSession> {
  const start = Date.now();

  const response = await fetch("http://localhost:3000/api/simulator/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  const scrapingTime = Date.now() - start;

  return {
    sessionId: data.sessionId,
    companyName: data.companyName,
    welcomeMessage: data.welcomeMessage,
    systemPrompt: data.systemPrompt,
    scrapingTime,
    conversationHistory: [],
  };
}

async function sendMessage(session: SimulatorSession, message: string): Promise<string> {
  const response = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: session.sessionId,
      message,
      systemPrompt: session.systemPrompt,
      conversationHistory: session.conversationHistory,
      companyName: session.companyName,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  const assistantMessage = data.message || data.response || "";

  // Actualizar historial
  session.conversationHistory.push({ role: 'user', content: message });
  session.conversationHistory.push({ role: 'assistant', content: assistantMessage });

  return assistantMessage;
}

function evaluateResponse(pregunta: string, respuesta: string): { tieneInfoEspecifica: boolean; pareceInventado: boolean; redFlags: string[] } {
  const redFlags: string[] = [];
  let tieneInfoEspecifica = false;
  let pareceInventado = false;

  // Detectar respuestas genéricas
  const genericPhrases = [
    "no tengo esa información",
    "no cuento con",
    "no tengo cargad",
    "no dispongo",
    "te recomiendo contactar",
    "podés consultar",
    "no tengo datos específicos",
  ];

  const respuestaLower = respuesta.toLowerCase();
  const isGeneric = genericPhrases.some(p => respuestaLower.includes(p));

  // Detectar información específica
  const hasNumbers = /\d+\s*(m²|m2|metros|usd|\$|dormitorio|baño)/i.test(respuesta);
  const hasModelNames = /\b(modelo|casa|vivienda)\s+[A-Z0-9]/i.test(respuesta);
  const hasPhoneNumber = /(\+?54|011|15|0800)[\s\-]?[\d\s\-]{6,}/i.test(respuesta);

  tieneInfoEspecifica = hasNumbers || hasModelNames || hasPhoneNumber;

  // Detectar posibles invenciones
  // Precios muy redondos (ej: USD 50.000, USD 100.000)
  const roundPrices = respuesta.match(/USD?\s*([\d,.]+)/gi) || [];
  for (const price of roundPrices) {
    const num = parseFloat(price.replace(/[^\d.]/g, ''));
    if (num > 0 && num % 10000 === 0 && num >= 50000) {
      redFlags.push(`Precio muy redondo: ${price}`);
    }
  }

  // Datos que parecen inventados
  if (respuestaLower.includes("aproximadamente") && hasNumbers && pregunta.toLowerCase().includes("precio")) {
    // OK, está siendo honesto
  }

  // Modelos con nombres genéricos sin contexto
  const genericModelNames = ["modelo a", "modelo b", "modelo c", "casa tipo"];
  for (const name of genericModelNames) {
    if (respuestaLower.includes(name)) {
      redFlags.push(`Nombre de modelo genérico: ${name}`);
    }
  }

  // Si dice "no tengo" pero igual da datos
  if (isGeneric && tieneInfoEspecifica) {
    redFlags.push("Contradictorio: dice no tener info pero da datos");
  }

  // Verificar si no tiene info cuando debería
  if (pregunta.toLowerCase().includes("whatsapp") && !hasPhoneNumber && !isGeneric) {
    redFlags.push("No dio WhatsApp cuando se preguntó");
  }

  pareceInventado = redFlags.length > 0;

  return { tieneInfoEspecifica, pareceInventado, redFlags };
}

async function testEmpresa(empresa: { name: string; url: string }): Promise<ConversationResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🏢 Testeando: ${empresa.name}`);
  console.log(`   URL: ${empresa.url}`);
  console.log("=".repeat(60));

  const result: ConversationResult = {
    empresa: empresa.name,
    url: empresa.url,
    sessionId: "",
    scrapingTime: 0,
    status: "OK",
    respuestas: [],
    metricas: {
      totalPreguntas: PREGUNTAS.length,
      respuestasEspecificas: 0,
      respuestasDudosas: 0,
      score: 0,
    },
  };

  try {
    // Crear simulador
    console.log("📡 Creando simulador (scraping)...");
    const session = await createSimulator(empresa.url);

    result.sessionId = session.sessionId;
    result.scrapingTime = session.scrapingTime;
    result.welcomeMessage = session.welcomeMessage;

    console.log(`✅ Scraping completado en ${(session.scrapingTime / 1000).toFixed(1)}s`);
    console.log(`   Empresa detectada: ${session.companyName}`);
    console.log(`   Bienvenida: ${session.welcomeMessage.slice(0, 100)}...`);

    // Hacer preguntas
    for (const pregunta of PREGUNTAS) {
      console.log(`\n❓ ${pregunta.key}: "${pregunta.text.slice(0, 50)}..."`);

      try {
        const respuesta = await sendMessage(session, pregunta.text);
        const evaluation = evaluateResponse(pregunta.text, respuesta);

        result.respuestas.push({
          pregunta: pregunta.text,
          respuesta,
          ...evaluation,
        });

        if (evaluation.tieneInfoEspecifica) {
          result.metricas.respuestasEspecificas++;
        }
        if (evaluation.pareceInventado) {
          result.metricas.respuestasDudosas++;
        }

        const status = evaluation.tieneInfoEspecifica
          ? (evaluation.pareceInventado ? "⚠️" : "✅")
          : "❌";
        console.log(`   ${status} Info específica: ${evaluation.tieneInfoEspecifica}`);
        if (evaluation.redFlags.length > 0) {
          console.log(`   🚩 Red flags: ${evaluation.redFlags.join(", ")}`);
        }

        // Delay entre preguntas
        await new Promise(r => setTimeout(r, 1000));

      } catch (err) {
        console.log(`   ❌ Error en pregunta: ${err}`);
        result.respuestas.push({
          pregunta: pregunta.text,
          respuesta: `ERROR: ${err}`,
          tieneInfoEspecifica: false,
          pareceInventado: false,
          redFlags: [`Error: ${err}`],
        });
      }
    }

    // Calcular score
    result.metricas.score = Math.round(
      ((result.metricas.respuestasEspecificas / result.metricas.totalPreguntas) * 70) +
      ((1 - result.metricas.respuestasDudosas / result.metricas.totalPreguntas) * 30)
    );

    console.log(`\n📊 Score final: ${result.metricas.score}%`);
    console.log(`   Específicas: ${result.metricas.respuestasEspecificas}/${result.metricas.totalPreguntas}`);
    console.log(`   Dudosas: ${result.metricas.respuestasDudosas}/${result.metricas.totalPreguntas}`);

  } catch (err) {
    console.log(`❌ ERROR: ${err}`);
    result.status = "ERROR";
    result.error = String(err);
  }

  return result;
}

async function main() {
  console.log("🚀 Iniciando QA de 20 empresas");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📝 ${PREGUNTAS.length} preguntas por empresa`);
  console.log(`🏢 ${EMPRESAS.length} empresas a testear`);

  const results: ConversationResult[] = [];
  const dudosas: { empresa: string; pregunta: string; respuesta: string; redFlags: string[] }[] = [];

  for (const empresa of EMPRESAS) {
    const result = await testEmpresa(empresa);
    results.push(result);

    // Recopilar respuestas dudosas
    for (const resp of result.respuestas) {
      if (resp.pareceInventado || resp.redFlags.length > 0) {
        dudosas.push({
          empresa: result.empresa,
          pregunta: resp.pregunta,
          respuesta: resp.respuesta.slice(0, 500),
          redFlags: resp.redFlags,
        });
      }
    }

    // Delay entre empresas
    await new Promise(r => setTimeout(r, 2000));
  }

  // Generar reporte
  const successCount = results.filter(r => r.status === "OK").length;
  const avgScore = results.filter(r => r.status === "OK").reduce((a, b) => a + b.metricas.score, 0) / successCount;

  const report = {
    fecha: new Date().toISOString(),
    resumen: {
      totalEmpresas: EMPRESAS.length,
      exitosas: successCount,
      fallidas: EMPRESAS.length - successCount,
      scorePromedio: Math.round(avgScore),
      respuestasDudosas: dudosas.length,
    },
    empresasPorScore: results
      .filter(r => r.status === "OK")
      .sort((a, b) => b.metricas.score - a.metricas.score)
      .map(r => ({
        empresa: r.empresa,
        score: r.metricas.score,
        especificas: r.metricas.respuestasEspecificas,
        dudosas: r.metricas.respuestasDudosas,
        scrapingTime: `${(r.scrapingTime / 1000).toFixed(1)}s`,
      })),
    respuestasDudosas: dudosas,
    resultadosCompletos: results,
  };

  // Guardar reporte
  const fs = await import("fs");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = `logs/qa-20-empresas-${timestamp}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Imprimir resumen
  console.log("\n" + "=".repeat(60));
  console.log("📋 RESUMEN FINAL");
  console.log("=".repeat(60));
  console.log(`✅ Exitosas: ${successCount}/${EMPRESAS.length}`);
  console.log(`📊 Score promedio: ${Math.round(avgScore)}%`);
  console.log(`⚠️ Respuestas dudosas: ${dudosas.length}`);
  console.log(`📁 Reporte guardado en: ${reportPath}`);

  console.log("\n🏆 TOP 5 EMPRESAS:");
  for (const e of report.empresasPorScore.slice(0, 5)) {
    console.log(`   ${e.score}% - ${e.empresa} (${e.especificas}/5 específicas)`);
  }

  console.log("\n⚠️ EMPRESAS CON PROBLEMAS:");
  for (const e of report.empresasPorScore.filter(e => e.score < 50)) {
    console.log(`   ${e.score}% - ${e.empresa} (${e.dudosas} dudosas)`);
  }

  if (dudosas.length > 0) {
    console.log("\n🚩 RESPUESTAS DUDOSAS (para verificar manualmente):");
    for (const d of dudosas.slice(0, 10)) {
      console.log(`\n   📍 ${d.empresa}`);
      console.log(`   ❓ ${d.pregunta.slice(0, 50)}...`);
      console.log(`   🚩 ${d.redFlags.join(", ")}`);
    }
  }

  return report;
}

main().catch(console.error);

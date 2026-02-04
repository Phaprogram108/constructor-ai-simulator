/**
 * Script 3: QA Verify
 * Usa Claude Vision API para verificar que las respuestas del chat
 * coincidan con la información real de los screenshots
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = '/tmp/qa-screenshots';
const RESULTS_DIR = '/tmp/qa-results';
const REPORT_DIR = '/tmp/qa-report';

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

interface VerificationItem {
  category: string;
  claim: string;
  verdict: 'VERIFIED' | 'UNVERIFIED' | 'CANNOT_VERIFY' | 'FABRICATED';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string;
  screenshotUsed: string;
}

interface EmpresaVerification {
  empresa: string;
  url: string;
  timestamp: string;
  overallScore: number;
  verifications: VerificationItem[];
  summary: string;
  redFlags: string[];
}

async function loadImage(filepath: string): Promise<string> {
  const buffer = fs.readFileSync(filepath);
  return buffer.toString('base64');
}

async function getAvailableScreenshots(empresa: string): Promise<string[]> {
  const dir = path.join(SCREENSHOTS_DIR, empresa);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(dir, f));

  return files;
}

async function verifyWithVision(
  client: Anthropic,
  empresa: string,
  chatResults: TestResult,
  screenshots: string[]
): Promise<EmpresaVerification> {

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Verificando: ${empresa}`);
  console.log(`Screenshots disponibles: ${screenshots.length}`);
  console.log('='.repeat(50));

  if (screenshots.length === 0) {
    return {
      empresa,
      url: chatResults.url,
      timestamp: new Date().toISOString(),
      overallScore: 0,
      verifications: [],
      summary: 'No hay screenshots disponibles para verificar',
      redFlags: ['Sin screenshots para verificacion']
    };
  }

  // Preparar las respuestas para verificar
  const responsesToVerify = chatResults.questions
    .filter(q => !q.error && q.response)
    .map(q => `**${q.question}**\nRespuesta del agente: "${q.response}"`)
    .join('\n\n');

  // Cargar imagenes
  const imageContents: Anthropic.ImageBlockParam[] = [];
  for (const screenshotPath of screenshots.slice(0, 5)) { // Max 5 screenshots
    try {
      const base64 = await loadImage(screenshotPath);
      const filename = path.basename(screenshotPath);
      imageContents.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64
        }
      });
      console.log(`  Cargado: ${filename}`);
    } catch (error) {
      console.log(`  Error cargando ${screenshotPath}: ${error}`);
    }
  }

  if (imageContents.length === 0) {
    return {
      empresa,
      url: chatResults.url,
      timestamp: new Date().toISOString(),
      overallScore: 0,
      verifications: [],
      summary: 'No se pudieron cargar los screenshots',
      redFlags: ['Error cargando screenshots']
    };
  }

  // Prompt para Claude Vision
  const prompt = `Sos un auditor de QA verificando si un agente de IA está dando información REAL o INVENTADA sobre una empresa.

## Empresa: ${empresa}
## URL: ${chatResults.url}

## Screenshots del sitio web real:
Los screenshots adjuntos son capturas del sitio web REAL de la empresa.

## Respuestas del agente a verificar:
${responsesToVerify}

## Tu tarea:
Analizar cada respuesta del agente y verificar si la información coincide con lo que se ve en los screenshots.

IMPORTANTE:
- Si el agente menciona modelos específicos con nombres o precios, DEBEN aparecer en los screenshots
- Si el agente dice "no tengo información", eso está BIEN (es honesto)
- Si el agente inventa nombres de modelos, precios o información que NO aparece en los screenshots, eso es FABRICATED
- Si no podés verificar porque el screenshot no muestra esa sección, usa CANNOT_VERIFY

## Formato de respuesta (JSON estricto):
{
  "verifications": [
    {
      "category": "catalogo|precios|cobertura|financiacion|proceso",
      "claim": "Lo que afirma el agente",
      "verdict": "VERIFIED|UNVERIFIED|CANNOT_VERIFY|FABRICATED",
      "confidence": "HIGH|MEDIUM|LOW",
      "evidence": "Qué viste en el screenshot que confirma o refuta",
      "screenshotUsed": "nombre del screenshot relevante"
    }
  ],
  "overallScore": 0-100,
  "summary": "Resumen de la verificación en 2-3 oraciones",
  "redFlags": ["Lista de información potencialmente inventada"]
}

Responde SOLO con el JSON, sin texto adicional.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: prompt }
          ]
        }
      ]
    });

    // Extraer el JSON de la respuesta
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Respuesta inesperada de Claude');
    }

    // Parsear JSON
    let result;
    try {
      // Intentar extraer JSON del texto
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontro JSON en la respuesta');
      }
    } catch (parseError) {
      console.error('Error parseando respuesta:', content.text);
      throw parseError;
    }

    return {
      empresa,
      url: chatResults.url,
      timestamp: new Date().toISOString(),
      overallScore: result.overallScore || 0,
      verifications: result.verifications || [],
      summary: result.summary || 'Sin resumen',
      redFlags: result.redFlags || []
    };

  } catch (error) {
    console.error(`Error verificando ${empresa}:`, error);
    return {
      empresa,
      url: chatResults.url,
      timestamp: new Date().toISOString(),
      overallScore: 0,
      verifications: [],
      summary: `Error en verificación: ${error instanceof Error ? error.message : String(error)}`,
      redFlags: ['Error en proceso de verificación']
    };
  }
}

function generateReport(verifications: EmpresaVerification[]): string {
  let report = '';

  report += '='.repeat(80) + '\n';
  report += 'QA VERIFICATION REPORT\n';
  report += `Fecha: ${new Date().toISOString()}\n`;
  report += '='.repeat(80) + '\n\n';

  // Resumen general
  const avgScore = verifications.length > 0
    ? verifications.reduce((sum, v) => sum + v.overallScore, 0) / verifications.length
    : 0;

  report += '## RESUMEN GENERAL\n';
  report += `Empresas verificadas: ${verifications.length}\n`;
  report += `Score promedio: ${avgScore.toFixed(1)}%\n\n`;

  // Tabla resumen
  report += '## RESULTADOS POR EMPRESA\n';
  report += '-'.repeat(60) + '\n';
  report += 'Empresa'.padEnd(20) + 'Score'.padEnd(10) + 'Red Flags'.padEnd(10) + 'Status\n';
  report += '-'.repeat(60) + '\n';

  for (const v of verifications) {
    const status = v.overallScore >= 80 ? 'PASS' :
                   v.overallScore >= 50 ? 'WARN' : 'FAIL';
    const emoji = status === 'PASS' ? '[OK]' : status === 'WARN' ? '[!]' : '[X]';
    report += `${v.empresa.padEnd(20)}${(v.overallScore + '%').padEnd(10)}${String(v.redFlags.length).padEnd(10)}${emoji} ${status}\n`;
  }
  report += '-'.repeat(60) + '\n\n';

  // Detalle por empresa
  report += '## DETALLE POR EMPRESA\n\n';

  for (const v of verifications) {
    report += '='.repeat(60) + '\n';
    report += `### ${v.empresa}\n`;
    report += `URL: ${v.url}\n`;
    report += `Score: ${v.overallScore}%\n`;
    report += `Resumen: ${v.summary}\n`;
    report += '='.repeat(60) + '\n\n';

    if (v.redFlags.length > 0) {
      report += '**RED FLAGS:**\n';
      for (const flag of v.redFlags) {
        report += `  [X] ${flag}\n`;
      }
      report += '\n';
    }

    report += '**VERIFICACIONES:**\n';
    for (const item of v.verifications) {
      const icon = item.verdict === 'VERIFIED' ? '[OK]' :
                   item.verdict === 'FABRICATED' ? '[FABRICATED]' :
                   item.verdict === 'CANNOT_VERIFY' ? '[?]' : '[X]';
      report += `\n${icon} [${item.category}] ${item.claim}\n`;
      report += `    Veredicto: ${item.verdict} (${item.confidence})\n`;
      report += `    Evidencia: ${item.evidence}\n`;
    }

    report += '\n';
  }

  // Lista de empresas problematicas
  const problematic = verifications.filter(v => v.overallScore < 50 || v.redFlags.length > 2);
  if (problematic.length > 0) {
    report += '='.repeat(80) + '\n';
    report += '## EMPRESAS QUE REQUIEREN ATENCION\n';
    report += '='.repeat(80) + '\n\n';

    for (const v of problematic) {
      report += `- ${v.empresa}: Score ${v.overallScore}%, ${v.redFlags.length} red flags\n`;
      for (const flag of v.redFlags) {
        report += `    -> ${flag}\n`;
      }
    }
  }

  return report;
}

export async function runVerification(empresaFilter?: string): Promise<EmpresaVerification[]> {
  console.log('='.repeat(60));
  console.log('QA VERIFICATION');
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
  console.log(`Chat results: ${RESULTS_DIR}`);
  console.log('='.repeat(60));

  // Inicializar cliente de Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada. Agregala al archivo .env.local');
  }

  const client = new Anthropic({ apiKey });

  // Crear directorio de reportes
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // Cargar resultados de chat
  const resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'));

  const verifications: EmpresaVerification[] = [];

  for (const file of resultFiles) {
    const empresaName = file.replace('.json', '');

    // Filtrar si se especificó
    if (empresaFilter && !empresaName.toLowerCase().includes(empresaFilter.toLowerCase())) {
      continue;
    }

    const filepath = path.join(RESULTS_DIR, file);
    const chatResults: TestResult = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

    // Obtener screenshots
    const screenshots = await getAvailableScreenshots(empresaName);

    // Verificar con Vision
    const verification = await verifyWithVision(client, empresaName, chatResults, screenshots);
    verifications.push(verification);

    // Guardar resultado individual
    const verificationPath = path.join(REPORT_DIR, `${empresaName}-verification.json`);
    fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2));

    // Esperar para no saturar API
    await new Promise(r => setTimeout(r, 1000));
  }

  // Generar reporte
  const report = generateReport(verifications);
  const reportPath = path.join(REPORT_DIR, 'qa-report.txt');
  fs.writeFileSync(reportPath, report);
  console.log(`\nReporte guardado: ${reportPath}`);

  // Guardar JSON completo
  const fullReportPath = path.join(REPORT_DIR, 'qa-report.json');
  fs.writeFileSync(fullReportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    empresasVerificadas: verifications.length,
    avgScore: verifications.length > 0
      ? verifications.reduce((sum, v) => sum + v.overallScore, 0) / verifications.length
      : 0,
    verifications
  }, null, 2));

  // Mostrar reporte en consola
  console.log('\n' + report);

  return verifications;
}

// CLI
async function main() {
  // Cargar .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  const args = process.argv.slice(2);
  const filter = args.length > 0 ? args[0] : undefined;

  await runVerification(filter);
}

main().catch(console.error);

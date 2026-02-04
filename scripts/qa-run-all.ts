/**
 * Script Master: QA Run All
 * Ejecuta todo el pipeline de QA en secuencia y genera un reporte final
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const OUTPUT_BASE = '/tmp';
const SCREENSHOTS_DIR = `${OUTPUT_BASE}/qa-screenshots`;
const RESULTS_DIR = `${OUTPUT_BASE}/qa-results`;
const REPORT_DIR = `${OUTPUT_BASE}/qa-report`;

interface StepResult {
  step: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

interface FinalReport {
  timestamp: string;
  totalDuration: number;
  steps: StepResult[];
  summary: {
    capturesSuccess: number;
    capturesTotal: number;
    chatTestsSuccess: number;
    chatTestsTotal: number;
    verificationsCompleted: number;
    avgVerificationScore: number;
    problematicEmpresas: string[];
  };
}

async function runScript(scriptPath: string, description: string): Promise<StepResult> {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log(`EJECUTANDO: ${description}`);
  console.log(`Script: ${scriptPath}`);
  console.log('='.repeat(60));

  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      resolve({
        step: description,
        success: code === 0,
        duration,
        output: stdout,
        error: code !== 0 ? stderr || `Exit code: ${code}` : undefined
      });
    });

    child.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        step: description,
        success: false,
        duration,
        error: err.message
      });
    });
  });
}

function loadSummaryData(): FinalReport['summary'] {
  const summary: FinalReport['summary'] = {
    capturesSuccess: 0,
    capturesTotal: 0,
    chatTestsSuccess: 0,
    chatTestsTotal: 0,
    verificationsCompleted: 0,
    avgVerificationScore: 0,
    problematicEmpresas: []
  };

  // Cargar datos de capturas
  const captureSummaryPath = path.join(SCREENSHOTS_DIR, 'capture-summary.json');
  if (fs.existsSync(captureSummaryPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(captureSummaryPath, 'utf-8'));
      summary.capturesTotal = data.length;
      summary.capturesSuccess = data.filter((r: { screenshots: { success: boolean }[] }) =>
        r.screenshots && r.screenshots.filter((s: { success: boolean }) => s.success).length > 0
      ).length;
    } catch (e) {
      console.error('Error leyendo capture-summary.json:', e);
    }
  }

  // Cargar datos de chat tests
  const chatSummaryPath = path.join(RESULTS_DIR, '_summary.json');
  if (fs.existsSync(chatSummaryPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(chatSummaryPath, 'utf-8'));
      summary.chatTestsTotal = data.empresasTesteadas || 0;
      summary.chatTestsSuccess = data.results?.filter((r: { questionsAnswered: number }) =>
        r.questionsAnswered > 0
      ).length || 0;
    } catch (e) {
      console.error('Error leyendo _summary.json:', e);
    }
  }

  // Cargar datos de verificación
  const verificationReportPath = path.join(REPORT_DIR, 'qa-report.json');
  if (fs.existsSync(verificationReportPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(verificationReportPath, 'utf-8'));
      summary.verificationsCompleted = data.empresasVerificadas || 0;
      summary.avgVerificationScore = data.avgScore || 0;

      // Encontrar empresas problemáticas
      if (data.verifications) {
        summary.problematicEmpresas = data.verifications
          .filter((v: { overallScore: number; redFlags: string[] }) =>
            v.overallScore < 50 || (v.redFlags && v.redFlags.length > 2)
          )
          .map((v: { empresa: string }) => v.empresa);
      }
    } catch (e) {
      console.error('Error leyendo qa-report.json:', e);
    }
  }

  return summary;
}

function generateFinalReport(steps: StepResult[], totalDuration: number): FinalReport {
  const summary = loadSummaryData();

  return {
    timestamp: new Date().toISOString(),
    totalDuration,
    steps,
    summary
  };
}

function printFinalReport(report: FinalReport): void {
  console.log('\n');
  console.log('#'.repeat(80));
  console.log('#' + ' '.repeat(30) + 'REPORTE FINAL QA' + ' '.repeat(32) + '#');
  console.log('#'.repeat(80));
  console.log();

  // Resumen de pasos
  console.log('## PASOS EJECUTADOS');
  console.log('-'.repeat(60));
  for (const step of report.steps) {
    const status = step.success ? '[OK]' : '[FAIL]';
    const duration = (step.duration / 1000).toFixed(1);
    console.log(`${status} ${step.step} (${duration}s)`);
    if (!step.success && step.error) {
      console.log(`    Error: ${step.error.substring(0, 100)}`);
    }
  }
  console.log();

  // Resumen de métricas
  console.log('## METRICAS');
  console.log('-'.repeat(60));
  console.log(`Tiempo total: ${(report.totalDuration / 1000 / 60).toFixed(1)} minutos`);
  console.log();
  console.log(`Screenshots capturados: ${report.summary.capturesSuccess}/${report.summary.capturesTotal} empresas`);
  console.log(`Tests de chat exitosos: ${report.summary.chatTestsSuccess}/${report.summary.chatTestsTotal} empresas`);
  console.log(`Verificaciones completadas: ${report.summary.verificationsCompleted}`);
  console.log(`Score promedio de verificación: ${report.summary.avgVerificationScore.toFixed(1)}%`);
  console.log();

  // Resultado final
  const allStepsOk = report.steps.every(s => s.success);
  const scoreOk = report.summary.avgVerificationScore >= 70;

  console.log('## RESULTADO FINAL');
  console.log('-'.repeat(60));

  if (allStepsOk && scoreOk && report.summary.problematicEmpresas.length === 0) {
    console.log('[PASS] Sistema de QA completado exitosamente');
    console.log('       El simulador está devolviendo información verificada');
  } else if (report.summary.problematicEmpresas.length > 0) {
    console.log('[WARN] Sistema de QA completado con advertencias');
    console.log('       Las siguientes empresas requieren revisión:');
    for (const empresa of report.summary.problematicEmpresas) {
      console.log(`       - ${empresa}`);
    }
  } else {
    console.log('[FAIL] Sistema de QA completado con errores');
    console.log('       Revisar los pasos que fallaron arriba');
  }

  console.log();
  console.log('## ARCHIVOS GENERADOS');
  console.log('-'.repeat(60));
  console.log(`Screenshots: ${SCREENSHOTS_DIR}/`);
  console.log(`Respuestas del chat: ${RESULTS_DIR}/`);
  console.log(`Reporte de verificación: ${REPORT_DIR}/qa-report.txt`);
  console.log(`Reporte JSON: ${REPORT_DIR}/qa-report.json`);
  console.log(`Reporte final: ${REPORT_DIR}/final-report.json`);

  console.log('\n' + '#'.repeat(80) + '\n');
}

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('#'.repeat(60));
  console.log('#' + ' '.repeat(18) + 'QA EXHAUSTIVO PIPELINE' + ' '.repeat(18) + '#');
  console.log('#'.repeat(60));
  console.log();
  console.log('Este script ejecuta:');
  console.log('  1. Captura visual de screenshots de cada empresa');
  console.log('  2. Tests de chat con preguntas estandarizadas');
  console.log('  3. Verificación con Claude Vision');
  console.log();

  // Cargar .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log('Cargando variables de entorno desde .env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  // Verificar que el servidor esté corriendo
  console.log('\nVerificando servidor local...');
  try {
    const response = await fetch('http://localhost:3000', { method: 'HEAD' });
    if (!response.ok) {
      console.error('El servidor local no está respondiendo correctamente');
      console.log('Asegurate de ejecutar: npm run dev');
      process.exit(1);
    }
    console.log('Servidor OK\n');
  } catch {
    console.error('No se puede conectar al servidor local en http://localhost:3000');
    console.log('Asegurate de ejecutar: npm run dev');
    process.exit(1);
  }

  const steps: StepResult[] = [];
  const args = process.argv.slice(2);
  const skipCapture = args.includes('--skip-capture');
  const skipChat = args.includes('--skip-chat');
  const skipVerify = args.includes('--skip-verify');
  const empresaFilter = args.find(a => !a.startsWith('--'));

  // Paso 1: Captura visual
  if (!skipCapture) {
    const captureScript = path.join(process.cwd(), 'scripts/qa-visual-capture.ts');
    const captureResult = await runScript(captureScript, 'Captura Visual de Screenshots');
    steps.push(captureResult);

    if (!captureResult.success) {
      console.log('\n[WARN] La captura visual falló, pero continuamos con los demás pasos');
    }
  } else {
    console.log('\n[SKIP] Captura visual (--skip-capture)');
  }

  // Paso 2: Tests de chat
  if (!skipChat) {
    const chatScript = path.join(process.cwd(), 'scripts/qa-chat-test.ts');
    const chatResult = await runScript(chatScript, 'Tests de Chat con el Simulador');
    steps.push(chatResult);

    if (!chatResult.success) {
      console.log('\n[WARN] Los tests de chat fallaron, pero continuamos con verificación');
    }
  } else {
    console.log('\n[SKIP] Tests de chat (--skip-chat)');
  }

  // Paso 3: Verificación con Vision
  if (!skipVerify) {
    // Verificar que existan los archivos necesarios
    const hasResults = fs.existsSync(RESULTS_DIR) &&
                       fs.readdirSync(RESULTS_DIR).some(f => f.endsWith('.json') && !f.startsWith('_'));

    if (hasResults) {
      const verifyScript = path.join(process.cwd(), 'scripts/qa-verify.ts');
      const verifyResult = await runScript(verifyScript, 'Verificación con Claude Vision');
      steps.push(verifyResult);
    } else {
      console.log('\n[SKIP] Verificación - No hay resultados de chat para verificar');
      steps.push({
        step: 'Verificación con Claude Vision',
        success: false,
        duration: 0,
        error: 'No hay resultados de chat disponibles'
      });
    }
  } else {
    console.log('\n[SKIP] Verificación (--skip-verify)');
  }

  // Generar reporte final
  const totalDuration = Date.now() - startTime;
  const finalReport = generateFinalReport(steps, totalDuration);

  // Guardar reporte
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  const finalReportPath = path.join(REPORT_DIR, 'final-report.json');
  fs.writeFileSync(finalReportPath, JSON.stringify(finalReport, null, 2));

  // Mostrar reporte
  printFinalReport(finalReport);

  // Exit code basado en resultado
  const success = steps.every(s => s.success) &&
                  finalReport.summary.problematicEmpresas.length === 0;
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});

import * as fs from 'fs';
import * as path from 'path';
import { CompanyEvaluation, EvaluationResult } from './quality-evaluator';

interface BatchReport {
  batchId: string;
  timestamp: string;
  config: {
    baseUrl: string;
    totalCompanies: number;
    questionsPerCompany: number;
  };
  summary: {
    companiesTested: number;
    companiesPassed: number;
    passRate: number;
    averageScore: number;
    bestCompany: { name: string; score: number } | null;
    worstCompany: { name: string; score: number } | null;
  };
  questionStats: Array<{
    questionId: string;
    question: string;
    averageScore: number;
    passRate: number;
  }>;
  companies: CompanyEvaluation[];
  recommendations: string[];
}

export function generateBatchReport(
  evaluations: CompanyEvaluation[],
  config: { baseUrl: string; questionsPerCompany: number }
): BatchReport {
  const batchId = `batch-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Handle empty evaluations case
  if (evaluations.length === 0) {
    return {
      batchId,
      timestamp,
      config: {
        baseUrl: config.baseUrl,
        totalCompanies: 0,
        questionsPerCompany: config.questionsPerCompany,
      },
      summary: {
        companiesTested: 0,
        companiesPassed: 0,
        passRate: 0,
        averageScore: 0,
        bestCompany: null,
        worstCompany: null,
      },
      questionStats: [],
      companies: [],
      recommendations: ['No hay evaluaciones para generar recomendaciones.'],
    };
  }

  // Summary calculations
  const companiesPassed = evaluations.filter(e => e.passed).length;
  const averageScore = Math.round(
    evaluations.reduce((sum, e) => sum + e.averageScore, 0) / evaluations.length
  );

  const sortedByScore = [...evaluations].sort((a, b) => b.averageScore - a.averageScore);
  const bestCompany = sortedByScore.length > 0
    ? { name: sortedByScore[0].companyName, score: sortedByScore[0].averageScore }
    : null;
  const worstCompany = sortedByScore.length > 0
    ? { name: sortedByScore[sortedByScore.length - 1].companyName, score: sortedByScore[sortedByScore.length - 1].averageScore }
    : null;

  // Question stats
  const questionStats = calculateQuestionStats(evaluations);

  // Generate recommendations
  const recommendations = generateRecommendations(evaluations, questionStats);

  return {
    batchId,
    timestamp,
    config: {
      baseUrl: config.baseUrl,
      totalCompanies: evaluations.length,
      questionsPerCompany: config.questionsPerCompany,
    },
    summary: {
      companiesTested: evaluations.length,
      companiesPassed,
      passRate: Math.round((companiesPassed / evaluations.length) * 100),
      averageScore,
      bestCompany,
      worstCompany,
    },
    questionStats,
    companies: evaluations,
    recommendations,
  };
}

function calculateQuestionStats(
  evaluations: CompanyEvaluation[]
): BatchReport['questionStats'] {
  const questionMap = new Map<string, { scores: number[]; question: string }>();

  for (const company of evaluations) {
    for (const evaluation of company.evaluations) {
      if (!questionMap.has(evaluation.questionId)) {
        questionMap.set(evaluation.questionId, {
          scores: [],
          question: evaluation.question,
        });
      }
      questionMap.get(evaluation.questionId)!.scores.push(evaluation.totalScore);
    }
  }

  return Array.from(questionMap.entries()).map(([questionId, data]) => ({
    questionId,
    question: data.question,
    averageScore: Math.round(
      data.scores.reduce((a, b) => a + b, 0) / data.scores.length
    ),
    passRate: Math.round(
      (data.scores.filter(s => s >= 70).length / data.scores.length) * 100
    ),
  }));
}

function generateRecommendations(
  evaluations: CompanyEvaluation[],
  questionStats: BatchReport['questionStats']
): string[] {
  const recommendations: string[] = [];

  if (evaluations.length === 0) {
    return ['No hay evaluaciones para generar recomendaciones.'];
  }

  // Overall score recommendations
  const avgScore = evaluations.reduce((sum, e) => sum + e.averageScore, 0) / evaluations.length;

  if (avgScore < 70) {
    recommendations.push(
      `Score promedio (${Math.round(avgScore)}) esta por debajo del objetivo (70). ` +
      `Revisar prompt-generator.ts para mejorar la calidad de respuestas.`
    );
  }

  // Question-specific recommendations
  const lowScoringQuestions = questionStats.filter(q => q.averageScore < 70);
  for (const question of lowScoringQuestions) {
    recommendations.push(
      `Pregunta "${question.questionId}" tiene score bajo (${question.averageScore}). ` +
      `Revisar si el scraper extrae bien la informacion relacionada.`
    );
  }

  // Pattern analysis
  const allEvaluations = evaluations.flatMap(e => e.evaluations);
  const antiPatternCount = allEvaluations.reduce(
    (sum, e) => sum + e.antiPatternMatches.length, 0
  );

  if (antiPatternCount > 0) {
    recommendations.push(
      `Se detectaron ${antiPatternCount} anti-patrones en las respuestas. ` +
      `El agente esta diciendo "no se" o "no tengo informacion" cuando deberia responder.`
    );
  }

  // Tone analysis
  const avgTone = allEvaluations.length > 0
    ? allEvaluations.reduce((sum, e) => sum + e.scores.tone, 0) / allEvaluations.length
    : 0;
  if (avgTone < 80 && allEvaluations.length > 0) {
    recommendations.push(
      `El tono promedio (${Math.round(avgTone)}) puede mejorar. ` +
      `Ajustar el system prompt para ser mas calido y usar "vos".`
    );
  }

  // Action analysis
  const avgAction = allEvaluations.length > 0
    ? allEvaluations.reduce((sum, e) => sum + e.scores.action, 0) / allEvaluations.length
    : 0;
  if (avgAction < 70 && allEvaluations.length > 0) {
    recommendations.push(
      `El agente no esta calificando leads activamente (score accion: ${Math.round(avgAction)}). ` +
      `Agregar instrucciones en el prompt para pedir datos de contacto.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Excelente! El sistema esta funcionando correctamente.');
  }

  return recommendations;
}

export function saveReport(
  report: BatchReport,
  outputDir: string
): string {
  const reportDir = path.join(outputDir, report.batchId);

  // Create directory
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Save main report
  const reportPath = path.join(reportDir, 'summary-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Save individual company reports
  for (const company of report.companies) {
    const companyDir = path.join(reportDir, company.companyId);
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(companyDir, 'evaluation.json'),
      JSON.stringify(company, null, 2)
    );
  }

  // Generate markdown summary
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(path.join(reportDir, 'REPORT.md'), markdownReport);

  return reportPath;
}

function generateMarkdownReport(report: BatchReport): string {
  const lines: string[] = [
    `# Test Report - ${report.timestamp.split('T')[0]}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Companies Tested | ${report.summary.companiesTested} |`,
    `| Companies Passed | ${report.summary.companiesPassed} |`,
    `| Pass Rate | ${report.summary.passRate}% |`,
    `| Average Score | ${report.summary.averageScore}/100 |`,
    `| Best Company | ${report.summary.bestCompany?.name} (${report.summary.bestCompany?.score}) |`,
    `| Worst Company | ${report.summary.worstCompany?.name} (${report.summary.worstCompany?.score}) |`,
    '',
    '## Question Performance',
    '',
    `| Question | Avg Score | Pass Rate |`,
    `|----------|-----------|-----------|`,
  ];

  for (const q of report.questionStats) {
    lines.push(`| ${q.questionId} | ${q.averageScore} | ${q.passRate}% |`);
  }

  lines.push('', '## Company Results', '');

  for (const company of report.companies) {
    const status = company.passed ? 'PASS' : 'FAIL';
    lines.push(`### ${company.companyName} [${status}]`);
    lines.push(`- Score: ${company.averageScore}/100`);
    lines.push(`- URL: ${company.websiteUrl}`);
    lines.push('');
  }

  lines.push('', '## Recommendations', '');
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`);
  }

  return lines.join('\n');
}

export type { BatchReport };

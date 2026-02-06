/**
 * Diagnosis Script
 * Compares ground truth data with agent test results to diagnose pipeline failures.
 *
 * Usage:
 *   npx tsx scripts/diagnosis.ts
 *   npx tsx scripts/diagnosis.ts --company atlas-housing
 *   npx tsx scripts/diagnosis.ts --json-only
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroundTruthModel {
  name: string;
  detailUrl?: string;
  sqMeters?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  features: string[];
  source: 'detail_page' | 'catalog_page' | 'homepage';
  screenshot?: string;
}

interface GroundTruthData {
  company: string;
  url: string;
  capturedAt: string;
  type: 'modular' | 'tradicional' | 'mixta' | 'inmobiliaria' | 'unknown';
  companyProfile?: {
    identity: string;
    offering: string;
    terminology: string;
  };
  navigation: {
    menuItems: string[];
    modelSections: { label: string; url: string }[];
  };
  models: GroundTruthModel[];
  contactInfo: {
    whatsapp?: string;
    email?: string;
    phone?: string;
    instagram?: string;
  };
  totalModelsFound: number;
  pagesExplored: number;
  errors: string[];
}

type QuestionType =
  | 'base'
  | 'model_specific'
  | 'identity'
  | 'offering'
  | 'contact'
  | 'product_count'
  | 'product_specific'
  | 'product_specs'
  | 'financing'
  | 'coverage'
  | 'differentiator';

interface AgentConversation {
  question: string;
  questionType: QuestionType;
  response: string;
  mentionedModels: string[];
  saidNoInfo: boolean;
  hasSpecificData: boolean;
  responseTimeMs: number;
}

interface AgentTestResult {
  company: string;
  url: string;
  testedAt: string;
  sessionId: string;
  systemPromptLength: number;
  systemPromptModelsFound: string[];
  systemPromptWhatsApp?: string;
  systemPromptType?: string;
  conversations: AgentConversation[];
  sessionCreationTimeMs: number;
  errors: string[];
}

type GapType = 'SCRAPING_MISS' | 'PROMPT_MISS' | 'HALLUCINATION' | 'IDENTITY_MISS' | 'TERMINOLOGY_MISS';
type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

interface Gap {
  type: GapType;
  entity: string;
  detail: string;
  severity: Severity;
  groundTruthValue?: string;
  systemPromptValue?: string;
  agentResponseValue?: string;
}

interface ScoreBreakdown {
  productCoverage: number;     // % de productos del GT mencionados por el agente (0-100)
  specAccuracy: number;        // % de specs correctas (0-100)
  contactAccuracy: number;     // Contacto correcto? (0 o 100)
  hallucinationPenalty: number; // Puntos perdidos por hallucinations
  identityMatch: number;       // El agente entiende qué es la empresa? (0-100)
}

interface GapSummary {
  scrapingMiss: number;
  promptMiss: number;
  hallucination: number;
}

interface CompanyDiagnosis {
  company: string;
  url: string;
  diagnosedAt: string;
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  groundTruthModels: number;
  systemPromptModels: number;
  agentResponseModels: number;
  gaps: Gap[];
  gapSummary: GapSummary;
  recommendations: string[];
}

interface TestCompaniesFile {
  companies: {
    problematicas: { name: string; url: string }[];
    aleatorias: { name: string; url: string }[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();

  // Exact match
  if (na === nb) return true;

  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true;

  // Word overlap >= 70%
  const wordsA = na.split(/\s+/).filter(Boolean);
  const wordsB = nb.split(/\s+/).filter(Boolean);
  const totalWords = Math.max(wordsA.length, wordsB.length);
  if (totalWords === 0) return false;

  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.some(wb => wb === w || wb.includes(w) || w.includes(wb))) {
      shared++;
    }
  }

  return shared / totalWords >= 0.7;
}

function findMatchInList(name: string, list: string[]): string | undefined {
  return list.find(item => fuzzyMatch(name, item));
}

function collectAllAgentMentionedModels(agent: AgentTestResult): string[] {
  const all = new Set<string>();
  for (const conv of agent.conversations) {
    for (const m of conv.mentionedModels) {
      all.add(m);
    }
  }
  return Array.from(all);
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`  [WARN] Could not read ${filePath}: ${err}`);
    return null;
  }
}

function parseArgs(): { company?: string; jsonOnly: boolean } {
  const args = process.argv.slice(2);
  let company: string | undefined;
  let jsonOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) {
      company = args[i + 1];
      i++;
    } else if (args[i] === '--json-only') {
      jsonOnly = true;
    }
  }

  return { company, jsonOnly };
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function calculateScore(breakdown: ScoreBreakdown): number {
  const weights = {
    productCoverage: 0.35,
    specAccuracy: 0.20,
    contactAccuracy: 0.15,
    identityMatch: 0.15,
  };

  const base = (
    breakdown.productCoverage * weights.productCoverage +
    breakdown.specAccuracy * weights.specAccuracy +
    breakdown.contactAccuracy * weights.contactAccuracy +
    breakdown.identityMatch * weights.identityMatch
  );

  // Penalty: -10 por cada hallucination, máx 15 puntos
  const penalty = Math.min(breakdown.hallucinationPenalty, 15);

  return Math.max(0, Math.round(base - penalty));
}

function checkIdentityMatch(
  groundTruth: GroundTruthData,
  agentResponses: AgentTestResult
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Buscar en la primera respuesta (identity question) si el agente
  // describe correctamente la empresa
  const identityResponse = agentResponses.conversations?.find(
    c => c.questionType === 'identity' || c.question.toLowerCase().includes('que es') || c.question.toLowerCase().includes('qué es')
  );

  if (!identityResponse) {
    // No se hizo la pregunta de identidad - intentar con todas las respuestas
    const allResponseText = agentResponses.conversations.map(c => c.response).join(' ').toLowerCase();

    // Check basic identity markers from ground truth
    if (groundTruth.companyProfile) {
      const identity = groundTruth.companyProfile.identity.toLowerCase();

      // Extract key concepts (words longer than 4 chars)
      const keyWords = identity.split(/\s+/).filter(w => w.length > 4);
      const matchedWords = keyWords.filter(w => allResponseText.includes(w));
      const matchRatio = keyWords.length > 0 ? matchedWords.length / keyWords.length : 1;

      if (matchRatio < 0.3) {
        score -= 40;
        issues.push('Agente no refleja la identidad de la empresa');
      }
    }

    return { score: Math.max(0, score), issues };
  }

  const response = identityResponse.response.toLowerCase();

  // Si GT tiene companyProfile, comparar
  if (groundTruth.companyProfile) {
    const identity = groundTruth.companyProfile.identity.toLowerCase();

    // Check if key concepts from GT identity appear in response
    const keyWords = identity.split(/\s+/).filter(w => w.length > 4);
    const matchedWords = keyWords.filter(w => response.includes(w));
    const matchRatio = keyWords.length > 0 ? matchedWords.length / keyWords.length : 1;

    if (matchRatio < 0.3) {
      score -= 40;
      issues.push('Agente no refleja la identidad de la empresa');
    }
  }

  // Type-based checks (legacy support for when companyProfile is not available)
  // Si GT dice tipo "inmobiliaria" pero agente habla de "casas modulares"
  if (groundTruth.type === 'inmobiliaria' &&
      response.includes('modular')) {
    score -= 50;
    issues.push('Agente menciona "modular" pero empresa es inmobiliaria');
  }

  // Si GT dice tipo "tradicional" pero agente habla de "catalogo de modelos"
  if (groundTruth.type === 'tradicional' &&
      (response.includes('catalogo de modelos') || response.includes('catálogo de modelos'))) {
    score -= 40;
    issues.push('Agente menciona "catalogo" pero empresa es de servicios a medida');
  }

  return { score: Math.max(0, score), issues };
}

// ---------------------------------------------------------------------------
// Core diagnosis logic
// ---------------------------------------------------------------------------

function diagnoseCompany(
  gt: GroundTruthData,
  agent: AgentTestResult
): CompanyDiagnosis {
  const gaps: Gap[] = [];
  const promptModels = agent.systemPromptModelsFound;
  const agentModels = collectAllAgentMentionedModels(agent);
  const allResponseText = agent.conversations.map(c => c.response).join(' ');

  // --- Model coverage ---
  let matchedModels = 0;

  for (const gtModel of gt.models) {
    const inPrompt = findMatchInList(gtModel.name, promptModels);
    const inAgent = findMatchInList(gtModel.name, agentModels);

    if (!inPrompt) {
      gaps.push({
        type: 'SCRAPING_MISS',
        entity: gtModel.name,
        detail: `Model "${gtModel.name}" exists in ground truth but was not found in systemPrompt`,
        severity: 'HIGH',
        groundTruthValue: gtModel.name,
      });
    } else if (!inAgent) {
      gaps.push({
        type: 'PROMPT_MISS',
        entity: gtModel.name,
        detail: `Model "${gtModel.name}" is in systemPrompt ("${inPrompt}") but agent never mentioned it in responses`,
        severity: 'MEDIUM',
        groundTruthValue: gtModel.name,
        systemPromptValue: inPrompt,
      });
    } else {
      matchedModels++;
    }

    // --- Specs coverage ---
    if (inPrompt) {
      const specs: { key: string; value: string }[] = [];
      if (gtModel.sqMeters) specs.push({ key: 'sqMeters', value: `${gtModel.sqMeters}` });
      if (gtModel.price) specs.push({ key: 'price', value: gtModel.price });
      if (gtModel.bedrooms) specs.push({ key: 'bedrooms', value: `${gtModel.bedrooms}` });

      for (const spec of specs) {
        const mentioned = allResponseText.includes(spec.value);
        const saidNoInfo = agent.conversations.some(
          c => fuzzyMatch(c.question, gtModel.name) && c.saidNoInfo
        );

        if (!mentioned && saidNoInfo) {
          gaps.push({
            type: 'PROMPT_MISS',
            entity: `${gtModel.name}/${spec.key}`,
            detail: `Agent said "no info" for ${spec.key} of "${gtModel.name}" but ground truth has: ${spec.value}`,
            severity: 'LOW',
            groundTruthValue: spec.value,
          });
        }
      }
    }
  }

  // --- Hallucination check ---
  for (const agentModel of agentModels) {
    const inGT = findMatchInList(agentModel, gt.models.map(m => m.name));
    const inPrompt = findMatchInList(agentModel, promptModels);

    if (!inGT && !inPrompt) {
      gaps.push({
        type: 'HALLUCINATION',
        entity: agentModel,
        detail: `Agent mentioned model "${agentModel}" which does not exist in ground truth or systemPrompt`,
        severity: 'HIGH',
        agentResponseValue: agentModel,
      });
    } else if (!inGT && inPrompt) {
      // In prompt but not GT - could be scraping error or GT incomplete
      // Still flag as hallucination since GT is source of truth
      gaps.push({
        type: 'HALLUCINATION',
        entity: agentModel,
        detail: `Agent mentioned model "${agentModel}" (from prompt: "${inPrompt}") which does not exist in ground truth`,
        severity: 'HIGH',
        systemPromptValue: inPrompt,
        agentResponseValue: agentModel,
      });
    }
  }

  // --- Price hallucination check ---
  const pricePattern = /USD?\s*\$?\s*[\d,.]+/gi;
  const agentPrices = allResponseText.match(pricePattern) || [];
  const gtPrices = gt.models.map(m => m.price).filter(Boolean) as string[];

  for (const agentPrice of agentPrices) {
    const normalized = agentPrice.replace(/[^\d]/g, '');
    if (normalized.length < 4) continue; // skip tiny numbers
    const matchesAny = gtPrices.some(gtp => gtp.replace(/[^\d]/g, '').includes(normalized));
    if (!matchesAny && gtPrices.length > 0) {
      gaps.push({
        type: 'HALLUCINATION',
        entity: 'price',
        detail: `Agent mentioned price "${agentPrice}" which does not match any ground truth price`,
        severity: 'HIGH',
        agentResponseValue: agentPrice,
        groundTruthValue: gtPrices.join(', '),
      });
    }
  }

  // --- Contact info coverage ---
  if (gt.contactInfo.whatsapp) {
    const gtWA = gt.contactInfo.whatsapp;
    const promptWA = agent.systemPromptWhatsApp;
    const agentMentionsWA = allResponseText.includes(gtWA) ||
      allResponseText.replace(/[\s\-()]/g, '').includes(gtWA.replace(/[\s\-()]/g, ''));

    if (!promptWA) {
      gaps.push({
        type: 'SCRAPING_MISS',
        entity: 'whatsapp',
        detail: `WhatsApp "${gtWA}" exists in ground truth but not in systemPrompt`,
        severity: 'MEDIUM',
        groundTruthValue: gtWA,
      });
    } else if (!agentMentionsWA) {
      gaps.push({
        type: 'PROMPT_MISS',
        entity: 'whatsapp',
        detail: `WhatsApp is in systemPrompt ("${promptWA}") but agent didn't share it in responses`,
        severity: 'LOW',
        groundTruthValue: gtWA,
        systemPromptValue: promptWA,
      });
    }
  }

  // --- Calculate score breakdown ---
  const gtModelCount = gt.models.length;

  // 1. Product Coverage
  let productCoverage = 0;
  if (gtModelCount > 0) {
    productCoverage = (matchedModels / gtModelCount) * 100;
  } else {
    // No products in GT - default to 100 if agent doesn't hallucinate
    const modelHallucinations = gaps.filter(
      g => g.type === 'HALLUCINATION' && g.entity !== 'price' && g.entity !== 'whatsapp'
    );
    productCoverage = modelHallucinations.length === 0 ? 100 : Math.max(0, 100 - modelHallucinations.length * 10);
  }

  // 2. Spec Accuracy
  const totalSpecs = gt.models.reduce((sum, m) => {
    let count = 0;
    if (m.sqMeters) count++;
    if (m.price) count++;
    if (m.bedrooms) count++;
    if (m.bathrooms) count++;
    return sum + count;
  }, 0);

  const specsInPrompt = gt.models.reduce((sum, m) => {
    const inPrompt = findMatchInList(m.name, promptModels);
    if (!inPrompt) return sum;
    let count = 0;
    if (m.sqMeters) count++;
    if (m.price) count++;
    if (m.bedrooms) count++;
    if (m.bathrooms) count++;
    return sum + count;
  }, 0);

  const specsMissedByAgent = gaps.filter(g =>
    g.type === 'PROMPT_MISS' && g.entity.includes('/')
  ).length;

  let specAccuracy = 100;
  if (totalSpecs > 0) {
    const correctSpecs = specsInPrompt - specsMissedByAgent;
    specAccuracy = Math.max(0, (correctSpecs / totalSpecs) * 100);
  }

  // 3. Contact Accuracy
  let contactAccuracy = 0;
  if (gt.contactInfo.whatsapp) {
    const gtWA = gt.contactInfo.whatsapp;
    const promptWA = agent.systemPromptWhatsApp;
    const agentMentionsWA = allResponseText.includes(gtWA) ||
      allResponseText.replace(/[\s\-()]/g, '').includes(gtWA.replace(/[\s\-()]/g, ''));

    if (promptWA && agentMentionsWA) {
      contactAccuracy = 100;
    } else if (promptWA && !agentMentionsWA) {
      contactAccuracy = 50; // In prompt but not shared
    }
    // else 0 - not scraped at all
  } else {
    // No contact info in GT - default to 100 if agent doesn't invent
    contactAccuracy = 100;
  }

  // 4. Hallucination Penalty
  const hallucinationCount = gaps.filter(g => g.type === 'HALLUCINATION').length;
  const hallucinationPenalty = hallucinationCount * 10;

  // 5. Identity Match
  const identityCheck = checkIdentityMatch(gt, agent);
  const identityMatch = identityCheck.score;

  // Add identity gaps if found
  if (identityCheck.issues.length > 0) {
    for (const issue of identityCheck.issues) {
      gaps.push({
        type: 'IDENTITY_MISS',
        entity: 'company_identity',
        detail: issue,
        severity: 'HIGH',
      });
    }
  }

  const scoreBreakdown: ScoreBreakdown = {
    productCoverage: Math.round(productCoverage),
    specAccuracy: Math.round(specAccuracy),
    contactAccuracy,
    hallucinationPenalty,
    identityMatch,
  };

  const overallScore = calculateScore(scoreBreakdown);

  // --- Recommendations per company ---
  const recommendations: string[] = [];
  const scrapingMisses = gaps.filter(g => g.type === 'SCRAPING_MISS');
  const promptMisses = gaps.filter(g => g.type === 'PROMPT_MISS');
  const hallucinations = gaps.filter(g => g.type === 'HALLUCINATION');

  if (scrapingMisses.length > 0) {
    const models = scrapingMisses.filter(g => g.entity !== 'whatsapp').map(g => g.entity);
    if (models.length > 0) {
      recommendations.push(`Scraping no encontro ${models.length} modelo(s): ${models.join(', ')}. Revisar firecrawl.ts URL patterns.`);
    }
    if (scrapingMisses.some(g => g.entity === 'whatsapp')) {
      recommendations.push('WhatsApp no fue extraido por el scraper. Revisar extraccion de contacto.');
    }
  }
  if (promptMisses.length > 0) {
    recommendations.push(`${promptMisses.length} dato(s) presentes en prompt pero no compartidos por el agente. Revisar prompt-generator.ts.`);
  }
  if (hallucinations.length > 0) {
    recommendations.push(`${hallucinations.length} dato(s) inventados por el agente. Reforzar anti-hallucination en prompt-generator.ts.`);
  }

  return {
    company: gt.company,
    url: gt.url,
    diagnosedAt: new Date().toISOString(),
    overallScore,
    scoreBreakdown,
    groundTruthModels: gtModelCount,
    systemPromptModels: promptModels.length,
    agentResponseModels: agentModels.length,
    gaps,
    gapSummary: {
      scrapingMiss: scrapingMisses.length,
      promptMiss: promptMisses.length,
      hallucination: hallucinations.length,
    },
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateMarkdownReport(diagnoses: CompanyDiagnosis[]): string {
  const now = new Date().toISOString();
  const totalGaps = diagnoses.reduce((s, d) => s + d.gaps.length, 0);
  const totalScraping = diagnoses.reduce((s, d) => s + d.gapSummary.scrapingMiss, 0);
  const totalPrompt = diagnoses.reduce((s, d) => s + d.gapSummary.promptMiss, 0);
  const totalHalluc = diagnoses.reduce((s, d) => s + d.gapSummary.hallucination, 0);
  const totalIdentity = diagnoses.reduce((s, d) => s + d.gaps.filter(g => g.type === 'IDENTITY_MISS').length, 0);
  const totalTerminology = diagnoses.reduce((s, d) => s + d.gaps.filter(g => g.type === 'TERMINOLOGY_MISS').length, 0);
  const avgScore = diagnoses.length > 0
    ? Math.round(diagnoses.reduce((s, d) => s + d.overallScore, 0) / diagnoses.length)
    : 0;

  const pctScraping = totalGaps > 0 ? Math.round((totalScraping / totalGaps) * 100) : 0;
  const pctPrompt = totalGaps > 0 ? Math.round((totalPrompt / totalGaps) * 100) : 0;
  const pctHalluc = totalGaps > 0 ? Math.round((totalHalluc / totalGaps) * 100) : 0;

  let md = '';

  md += '# Diagnostic Report - Constructor AI Pipeline\n\n';
  md += `**Generated:** ${now}\n`;
  md += `**Companies analyzed:** ${diagnoses.length}\n\n`;

  // Summary table
  md += '## Summary\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Average Score | ${avgScore}% |\n`;
  md += `| Total Gaps | ${totalGaps} |\n`;
  md += `| SCRAPING_MISS | ${totalScraping} (${pctScraping}%) |\n`;
  md += `| PROMPT_MISS | ${totalPrompt} (${pctPrompt}%) |\n`;
  md += `| HALLUCINATION | ${totalHalluc} (${pctHalluc}%) |\n`;
  md += `| IDENTITY_MISS | ${totalIdentity} |\n`;
  md += `| TERMINOLOGY_MISS | ${totalTerminology} |\n`;
  md += '\n';

  // Per company table
  md += '## Per Company Results\n\n';
  md += '| Company | GT Models | Prompt Models | Agent Models | Score | SCRAPING | PROMPT | HALLUC |\n';
  md += '|---------|-----------|---------------|--------------|-------|----------|--------|--------|\n';

  const sorted = [...diagnoses].sort((a, b) => a.overallScore - b.overallScore);
  for (const d of sorted) {
    md += `| ${d.company} | ${d.groundTruthModels} | ${d.systemPromptModels} | ${d.agentResponseModels} | ${d.overallScore}% | ${d.gapSummary.scrapingMiss} | ${d.gapSummary.promptMiss} | ${d.gapSummary.hallucination} |\n`;
  }
  md += '\n';

  // Score Breakdown per company
  md += '## Score Breakdown by Company\n\n';
  md += '| Company | Overall | Product Coverage | Spec Accuracy | Contact | Identity | Hallucination Penalty |\n';
  md += '|---------|---------|------------------|---------------|---------|----------|----------------------|\n';

  for (const d of sorted) {
    const sb = d.scoreBreakdown;
    md += `| ${d.company} | ${d.overallScore}% | ${sb.productCoverage}% | ${sb.specAccuracy}% | ${sb.contactAccuracy}% | ${sb.identityMatch}% | -${sb.hallucinationPenalty} |\n`;
  }
  md += '\n';

  // Top issues
  md += '## Top Issues\n\n';

  // SCRAPING_MISS
  const scrapingGaps = diagnoses.flatMap(d =>
    d.gaps.filter(g => g.type === 'SCRAPING_MISS').map(g => ({ company: d.company, gap: g }))
  );
  md += `### SCRAPING_MISS (${scrapingGaps.length} gaps)\n\n`;
  if (scrapingGaps.length === 0) {
    md += 'No scraping misses detected.\n\n';
  } else {
    // Group by company
    const byCompany = new Map<string, string[]>();
    for (const { company, gap } of scrapingGaps) {
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company)!.push(gap.entity);
    }
    for (const [company, entities] of Array.from(byCompany.entries())) {
      md += `- **${company}:** ${entities.join(', ')}\n`;
    }
    md += '\n';
  }

  // PROMPT_MISS
  const promptGaps = diagnoses.flatMap(d =>
    d.gaps.filter(g => g.type === 'PROMPT_MISS').map(g => ({ company: d.company, gap: g }))
  );
  md += `### PROMPT_MISS (${promptGaps.length} gaps)\n\n`;
  if (promptGaps.length === 0) {
    md += 'No prompt misses detected.\n\n';
  } else {
    const byCompany = new Map<string, string[]>();
    for (const { company, gap } of promptGaps) {
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company)!.push(gap.entity);
    }
    for (const [company, entities] of Array.from(byCompany.entries())) {
      md += `- **${company}:** ${entities.join(', ')}\n`;
    }
    md += '\n';
  }

  // HALLUCINATION
  const hallucGaps = diagnoses.flatMap(d =>
    d.gaps.filter(g => g.type === 'HALLUCINATION').map(g => ({ company: d.company, gap: g }))
  );
  md += `### HALLUCINATION (${hallucGaps.length} gaps)\n\n`;
  if (hallucGaps.length === 0) {
    md += 'No hallucinations detected.\n\n';
  } else {
    const byCompany = new Map<string, string[]>();
    for (const { company, gap } of hallucGaps) {
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company)!.push(`${gap.entity} - ${gap.detail}`);
    }
    for (const [company, details] of Array.from(byCompany.entries())) {
      md += `- **${company}:**\n`;
      for (const detail of details) {
        md += `  - ${detail}\n`;
      }
    }
    md += '\n';
  }

  // IDENTITY_MISS
  const identityGaps = diagnoses.flatMap(d =>
    d.gaps.filter(g => g.type === 'IDENTITY_MISS').map(g => ({ company: d.company, gap: g }))
  );
  md += `### IDENTITY_MISS (${identityGaps.length} gaps)\n\n`;
  if (identityGaps.length === 0) {
    md += 'No identity mismatches detected.\n\n';
  } else {
    const byCompany = new Map<string, string[]>();
    for (const { company, gap } of identityGaps) {
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company)!.push(gap.detail);
    }
    for (const [company, details] of Array.from(byCompany.entries())) {
      md += `- **${company}:** ${details.join('; ')}\n`;
    }
    md += '\n';
  }

  // TERMINOLOGY_MISS
  const terminologyGaps = diagnoses.flatMap(d =>
    d.gaps.filter(g => g.type === 'TERMINOLOGY_MISS').map(g => ({ company: d.company, gap: g }))
  );
  md += `### TERMINOLOGY_MISS (${terminologyGaps.length} gaps)\n\n`;
  if (terminologyGaps.length === 0) {
    md += 'No terminology mismatches detected.\n\n';
  } else {
    const byCompany = new Map<string, string[]>();
    for (const { company, gap } of terminologyGaps) {
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company)!.push(gap.detail);
    }
    for (const [company, details] of Array.from(byCompany.entries())) {
      md += `- **${company}:** ${details.join('; ')}\n`;
    }
    md += '\n';
  }

  // Recommendations
  md += '## Recommendations\n\n';
  const recs = generateGlobalRecommendations(diagnoses, totalGaps, totalScraping, totalPrompt, totalHalluc);
  recs.forEach((rec, i) => {
    md += `${i + 1}. ${rec}\n`;
  });
  md += '\n';

  return md;
}

function generateGlobalRecommendations(
  diagnoses: CompanyDiagnosis[],
  totalGaps: number,
  totalScraping: number,
  totalPrompt: number,
  totalHalluc: number
): string[] {
  const recs: string[] = [];

  if (totalGaps === 0) {
    recs.push('Pipeline is performing well. No major gaps detected.');
    return recs;
  }

  const scrapingPct = totalScraping / totalGaps;
  const promptPct = totalPrompt / totalGaps;

  if (scrapingPct > 0.5) {
    recs.push(
      '**HIGH PRIORITY:** Mejorar scraping pipeline (firecrawl.ts): agregar mas URL patterns, mejorar UNIVERSAL_ACTIONS. ' +
      `${totalScraping}/${totalGaps} gaps (${Math.round(scrapingPct * 100)}%) son por datos no scrapeados.`
    );
  }

  if (promptPct > 0.3) {
    recs.push(
      '**MEDIUM PRIORITY:** Mejorar prompt-generator.ts: revisar como se inyectan modelos y specs al system prompt. ' +
      `${totalPrompt}/${totalGaps} gaps (${Math.round(promptPct * 100)}%) son por datos no comunicados por el agente.`
    );
  }

  if (totalHalluc > 0) {
    recs.push(
      `**HIGH PRIORITY:** Reforzar anti-hallucination en prompt-generator.ts y response-validator.ts. ` +
      `${totalHalluc} hallucination(s) detectadas.`
    );

    // Check for price hallucinations specifically
    const priceHalluc = diagnoses.flatMap(d =>
      d.gaps.filter(g => g.type === 'HALLUCINATION' && g.entity === 'price')
    );
    if (priceHalluc.length > 0) {
      recs.push(
        `**HIGH PRIORITY:** ${priceHalluc.length} precio(s) inventados detectados. ` +
        'Agregar validacion de precios contra datos scrapeados antes de responder.'
      );
    }
  }

  // Specific pattern: many companies missing contact info
  const contactMisses = diagnoses.filter(d =>
    d.gaps.some(g => g.type === 'SCRAPING_MISS' && g.entity === 'whatsapp')
  );
  if (contactMisses.length >= 3) {
    recs.push(
      `WhatsApp no extraido en ${contactMisses.length} empresas. ` +
      'Revisar selectores de contacto en el scraper (buscar en footer, pagina de contacto, meta tags).'
    );
  }

  // Specific pattern: models found by scraper but agent ignores them
  const promptMissCompanies = diagnoses.filter(d => d.gapSummary.promptMiss > 0);
  if (promptMissCompanies.length >= 3) {
    recs.push(
      `En ${promptMissCompanies.length} empresas el agente ignora modelos que estan en su prompt. ` +
      'Revisar si el system prompt es demasiado largo y el LLM pierde contexto (considerar reducir/priorizar).'
    );
  }

  // Identity mismatches
  const identityMisses = diagnoses.filter(d =>
    d.gaps.some(g => g.type === 'IDENTITY_MISS')
  );
  if (identityMisses.length > 0) {
    recs.push(
      `**HIGH PRIORITY:** ${identityMisses.length} empresa(s) con identity mismatch. ` +
      'El agente no entiende correctamente que es la empresa. Revisar CompanyProfile en firecrawl.ts y prompt-generator.ts.'
    );
  }

  // Terminology mismatches
  const terminologyMisses = diagnoses.filter(d =>
    d.gaps.some(g => g.type === 'TERMINOLOGY_MISS')
  );
  if (terminologyMisses.length > 0) {
    recs.push(
      `**MEDIUM PRIORITY:** ${terminologyMisses.length} empresa(s) con terminology mismatch. ` +
      'El agente usa terminologia incorrecta. Reforzar uso de terminology del CompanyProfile en prompt-generator.ts.'
    );
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { company: companyFilter, jsonOnly } = parseArgs();
  const projectRoot = process.cwd();
  const groundTruthDir = path.join(projectRoot, 'ground-truth');
  const testCompaniesPath = path.join(projectRoot, 'src/scripts/test-companies.json');

  console.log('='.repeat(60));
  console.log('  DIAGNOSIS: Ground Truth vs Agent Pipeline');
  console.log('='.repeat(60));
  console.log();

  // Load test companies list
  const testCompanies = readJsonSafe<TestCompaniesFile>(testCompaniesPath);
  if (!testCompanies) {
    console.error(`[ERROR] Could not read test companies from ${testCompaniesPath}`);
    process.exit(1);
  }

  const allCompanies = [
    ...testCompanies.companies.problematicas,
    ...testCompanies.companies.aleatorias,
  ];

  // Filter if --company flag
  const companies = companyFilter
    ? allCompanies.filter(c => slugify(c.name) === companyFilter || slugify(c.name).includes(companyFilter))
    : allCompanies;

  if (companies.length === 0) {
    console.error(`[ERROR] No companies matched filter "${companyFilter}"`);
    console.log('Available slugs:');
    allCompanies.forEach(c => console.log(`  ${slugify(c.name)} (${c.name})`));
    process.exit(1);
  }

  console.log(`Companies to diagnose: ${companies.length}`);
  if (companyFilter) {
    console.log(`Filter: ${companyFilter}`);
  }
  console.log();

  // Ensure ground-truth dir exists
  if (!fs.existsSync(groundTruthDir)) {
    fs.mkdirSync(groundTruthDir, { recursive: true });
  }

  const diagnoses: CompanyDiagnosis[] = [];
  let skippedNoGT = 0;
  let skippedNoAgent = 0;

  for (const company of companies) {
    const slug = slugify(company.name);
    const companyDir = path.join(groundTruthDir, slug);
    const gtPath = path.join(companyDir, 'ground-truth.json');
    const agentPath = path.join(companyDir, 'agent-test.json');

    console.log(`[${slug}] Processing...`);

    const gt = readJsonSafe<GroundTruthData>(gtPath);
    if (!gt) {
      console.log(`  [SKIP] No ground-truth.json found`);
      skippedNoGT++;
      continue;
    }

    const agent = readJsonSafe<AgentTestResult>(agentPath);
    if (!agent) {
      console.log(`  [SKIP] No agent-test.json found`);
      skippedNoAgent++;
      continue;
    }

    const diagnosis = diagnoseCompany(gt, agent);
    diagnoses.push(diagnosis);

    // Save per-company diagnosis
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }
    const diagnosisPath = path.join(companyDir, 'diagnosis.json');
    fs.writeFileSync(diagnosisPath, JSON.stringify(diagnosis, null, 2));

    const gapStr = diagnosis.gaps.length > 0
      ? `${diagnosis.gapSummary.scrapingMiss}S/${diagnosis.gapSummary.promptMiss}P/${diagnosis.gapSummary.hallucination}H`
      : 'no gaps';
    console.log(`  Score: ${diagnosis.overallScore}% | GT: ${diagnosis.groundTruthModels} | Prompt: ${diagnosis.systemPromptModels} | Agent: ${diagnosis.agentResponseModels} | Gaps: ${gapStr}`);
  }

  console.log();
  console.log('-'.repeat(60));

  if (diagnoses.length === 0) {
    console.warn('[WARN] No companies had both ground-truth.json and agent-test.json.');
    console.warn(`  Skipped (no ground truth): ${skippedNoGT}`);
    console.warn(`  Skipped (no agent test): ${skippedNoAgent}`);
    console.warn('');
    console.warn('To generate ground truth data, manually create ground-truth/{company-slug}/ground-truth.json');
    console.warn('To generate agent test data, run the agent test pipeline and save to ground-truth/{company-slug}/agent-test.json');
    process.exit(0);
  }

  // Save consolidated JSON
  const consolidatedPath = path.join(groundTruthDir, 'consolidated-diagnosis.json');
  const consolidated = {
    generatedAt: new Date().toISOString(),
    companiesAnalyzed: diagnoses.length,
    companiesSkipped: { noGroundTruth: skippedNoGT, noAgentTest: skippedNoAgent },
    averageScore: Math.round(diagnoses.reduce((s, d) => s + d.overallScore, 0) / diagnoses.length),
    totalGaps: diagnoses.reduce((s, d) => s + d.gaps.length, 0),
    gapBreakdown: {
      scrapingMiss: diagnoses.reduce((s, d) => s + d.gapSummary.scrapingMiss, 0),
      promptMiss: diagnoses.reduce((s, d) => s + d.gapSummary.promptMiss, 0),
      hallucination: diagnoses.reduce((s, d) => s + d.gapSummary.hallucination, 0),
    },
    diagnoses,
  };
  fs.writeFileSync(consolidatedPath, JSON.stringify(consolidated, null, 2));
  console.log(`Consolidated JSON saved: ${consolidatedPath}`);

  // Generate markdown report
  if (!jsonOnly) {
    const reportPath = path.join(groundTruthDir, 'REPORT.md');
    const markdown = generateMarkdownReport(diagnoses);
    fs.writeFileSync(reportPath, markdown);
    console.log(`Markdown report saved: ${reportPath}`);
  }

  // Print summary
  console.log();
  console.log('='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Companies analyzed: ${diagnoses.length}`);
  console.log(`  Average score: ${consolidated.averageScore}%`);
  console.log(`  Total gaps: ${consolidated.totalGaps}`);
  console.log(`    SCRAPING_MISS: ${consolidated.gapBreakdown.scrapingMiss}`);
  console.log(`    PROMPT_MISS:   ${consolidated.gapBreakdown.promptMiss}`);
  console.log(`    HALLUCINATION: ${consolidated.gapBreakdown.hallucination}`);
  console.log();

  // Worst companies
  const worst = [...diagnoses].sort((a, b) => a.overallScore - b.overallScore).slice(0, 5);
  console.log('  Lowest scoring:');
  for (const d of worst) {
    console.log(`    ${d.overallScore}% - ${d.company} (${d.gaps.length} gaps)`);
  }
  console.log();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * Comparison Report Generator
 *
 * Reads ground-truth.json and agent-test.json for a company,
 * generates comparison.md with accuracy scoring.
 *
 * Usage:
 *   npx tsx tests/ground-truth/compare.ts --name "ViBert"
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GroundTruthReport {
  companyName: string;
  baseUrl: string;
  scannedAt: string;
  homepage: {
    title: string;
    metaDescription: string;
    fullText: string;
  };
  sections: {
    name: string;
    url: string;
    text: string;
  }[];
  models: {
    name: string;
    url: string;
    m2?: string;
    price?: string;
    rooms?: string;
    specs: string[];
    fullText: string;
  }[];
  pdfLinks: { text: string; href: string }[];
  navigation: { text: string; href: string }[];
  allLinks: { text: string; href: string }[];
}

interface AgentConversation {
  question: string;
  response: string;
  responseTimeMs: number;
  saidNoInfo: boolean;
  reSearchTriggered: boolean;
}

interface AgentTestResult {
  company: string;
  url: string;
  testedAt: string;
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  systemPromptPreview: string;
  systemPromptLength: number;
  sessionCreationTimeMs: number;
  conversations: AgentConversation[];
  summary: {
    totalQuestions: number;
    answered: number;
    noInfo: number;
    reSearches: number;
    avgResponseTimeMs: number;
  };
  errors: string[];
}

type Score = 'correct' | 'partial' | 'wrong' | 'not_in_gt';

interface QuestionScore {
  question: string;
  agentResponse: string;
  score: Score;
  scoreEmoji: string;
  reason: string;
}

interface ComparisonResult {
  company: string;
  url: string;
  groundTruthDate: string;
  agentTestDate: string;
  gtPagesScanned: number;
  gtModelsFound: number;
  scores: QuestionScore[];
  accuracy: number;
  keyGaps: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(): { name: string } {
  const args = process.argv.slice(2);
  let name = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    }
  }

  if (!name) {
    console.error('Usage: npx tsx compare.ts --name "CompanyName"');
    process.exit(1);
  }

  return { name };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
}

/**
 * Combine all ground truth text into one searchable string.
 */
function buildGTCorpus(gt: GroundTruthReport): string {
  const parts: string[] = [];
  parts.push(gt.homepage.fullText);
  for (const section of gt.sections) {
    parts.push(section.text);
  }
  for (const model of gt.models) {
    parts.push(model.fullText);
  }
  return parts.join(' ').toLowerCase();
}

/**
 * Check if a piece of info from the agent response can be verified in ground truth.
 */
function containsInfo(corpus: string, keywords: string[]): boolean {
  return keywords.some(kw => corpus.includes(kw.toLowerCase()));
}

/**
 * Score a question-answer pair based on ground truth.
 */
function scoreQuestion(
  question: string,
  response: string,
  saidNoInfo: boolean,
  gt: GroundTruthReport,
  corpus: string
): QuestionScore {
  const qLower = question.toLowerCase();
  const rLower = response.toLowerCase();

  // If agent errored out
  if (response.startsWith('[ERROR')) {
    return {
      question,
      agentResponse: response.slice(0, 200),
      score: 'wrong',
      scoreEmoji: '❌',
      reason: 'Agent returned an error',
    };
  }

  // --- Identity question ---
  if (qLower.includes('qué es tu empresa') || qLower.includes('qué hacen')) {
    const companyNameLower = (gt.companyName || '').toLowerCase();
    const hasCompanyName = (companyNameLower && rLower.includes(companyNameLower)) ||
      corpus.split(' ').slice(0, 200).some(word => word.length > 4 && rLower.includes(word));
    if (hasCompanyName && response.length > 50) {
      return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Agent described the company' };
    }
    if (response.length > 30) {
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Response present but company identity unclear' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: 'No meaningful identity info' };
  }

  // --- Products/services question ---
  if (qLower.includes('productos') || qLower.includes('servicios') || qLower.includes('ofrecen')) {
    if (gt.models.length > 0) {
      const mentionedModels = gt.models.filter(m =>
        rLower.includes(m.name.toLowerCase().slice(0, 10))
      );
      if (mentionedModels.length >= Math.min(2, gt.models.length)) {
        return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: `Mentioned ${mentionedModels.length}/${gt.models.length} models` };
      }
      if (mentionedModels.length > 0 || response.length > 80) {
        return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: `Mentioned ${mentionedModels.length}/${gt.models.length} models` };
      }
    }
    if (response.length > 50 && !saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Gave product info but could not verify against GT' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'No product data in ground truth to compare' };
  }

  // --- Model count question ---
  if (qLower.includes('cuántos') || qLower.includes('cuantos')) {
    if (gt.models.length > 0) {
      const countMatch = response.match(/(\d+)/);
      if (countMatch) {
        const agentCount = parseInt(countMatch[1]);
        if (agentCount === gt.models.length) {
          return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: `Count matches: ${agentCount}` };
        }
        if (Math.abs(agentCount - gt.models.length) <= 2) {
          return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: `Agent said ${agentCount}, GT has ${gt.models.length}` };
        }
        return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: `Agent said ${agentCount}, GT has ${gt.models.length}` };
      }
    }
    if (!saidNoInfo && response.length > 30) {
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Gave response but no specific count' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'Could not verify count' };
  }

  // --- Specific model question ---
  if (qLower.includes('contame sobre') || qLower.includes('detalles técnicos') || qLower.includes('detalles tecnicos')) {
    if (response.length > 100 && !saidNoInfo) {
      // Check if response contains verifiable data (m2, prices, specs)
      const hasSpecs = /\d+\s*(m2|m²|metros|dormitorio|baño|ambiente)/i.test(response);
      if (hasSpecs) {
        return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Provided specific model details with specs' };
      }
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Described model but no specific specs' };
    }
    if (saidNoInfo) {
      // Check if GT actually has this info
      const hasModelData = gt.models.length > 0;
      if (hasModelData) {
        return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: 'Said no info but GT has model data' };
      }
      return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'No info and GT also lacks data' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Short or unclear response' };
  }

  // --- Price question ---
  if (qLower.includes('cuánto sale') || qLower.includes('cuanto sale') || qLower.includes('precio')) {
    const hasPrice = /(?:USD|U\$D|US\$|AR\$|\$)\s*[\d.,]+/i.test(response) ||
                     /[\d.,]+\s*(?:USD|dolares|dólares)/i.test(response);
    const gtHasPrices = gt.models.some(m => m.price);

    if (hasPrice) {
      return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Provided price information' };
    }
    if (saidNoInfo && !gtHasPrices) {
      return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'No prices in GT either' };
    }
    if (saidNoInfo && gtHasPrices) {
      return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: 'GT has prices but agent does not' };
    }
    if (response.length > 50) {
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Discussed pricing without specific numbers' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: 'No useful price info' };
  }

  // --- What's included question ---
  if (qLower.includes('qué incluye') || qLower.includes('que incluye')) {
    if (response.length > 80 && !saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Described what is included' };
    }
    if (saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Agent does not have inclusion details' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Vague response' };
  }

  // --- Warranty question ---
  if (qLower.includes('garantía') || qLower.includes('garantia')) {
    const gtHasWarranty = containsInfo(corpus, ['garantía', 'garantia', 'warranty']);
    if (response.length > 50 && !saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Provided warranty info' };
    }
    if (saidNoInfo && !gtHasWarranty) {
      return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'No warranty info in GT' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Incomplete warranty info' };
  }

  // --- Contact question ---
  if (qLower.includes('whatsapp') || qLower.includes('teléfono') || qLower.includes('telefono')) {
    const hasContact = /(\+?\d[\d\s\-()]{7,}|wa\.me|whatsapp)/i.test(response);
    const gtHasContact = containsInfo(corpus, ['whatsapp', 'wa.me', 'teléfono', 'telefono', '+54']);
    if (hasContact) {
      return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Provided contact info' };
    }
    if (saidNoInfo && !gtHasContact) {
      return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'No contact in GT either' };
    }
    if (response.length > 40 && !saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Suggested contact but no specific number' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: 'No contact info provided' };
  }

  // --- Coverage/zones question ---
  if (qLower.includes('zonas') || qLower.includes('regiones') || qLower.includes('llegan')) {
    if (response.length > 50 && !saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'correct', scoreEmoji: '✅', reason: 'Provided coverage info' };
    }
    if (saidNoInfo) {
      return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'Coverage info may not be on website' };
    }
    return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Vague coverage info' };
  }

  // --- Default scoring ---
  if (saidNoInfo) {
    return { question, agentResponse: response.slice(0, 200), score: 'not_in_gt', scoreEmoji: '🔍', reason: 'Agent had no info' };
  }
  if (response.length > 80) {
    return { question, agentResponse: response.slice(0, 200), score: 'partial', scoreEmoji: '⚠️', reason: 'Response provided but could not verify' };
  }
  return { question, agentResponse: response.slice(0, 200), score: 'wrong', scoreEmoji: '❌', reason: 'Insufficient response' };
}

// ---------------------------------------------------------------------------
// Key gaps detection
// ---------------------------------------------------------------------------
function detectKeyGaps(gt: GroundTruthReport, agentTest: AgentTestResult): string[] {
  const gaps: string[] = [];
  const allResponses = agentTest.conversations.map(c => c.response).join(' ').toLowerCase();

  // Check if GT has models that agent never mentioned
  // Filter out garbage model names (nav elements, generic text)
  const junkPatterns = /^(ir al|ver |> |menu|inicio|home|contacto|nosotros|about|galeri|blog|faq|\d+$)/i;
  for (const model of gt.models) {
    const name = (model.name || '').trim();
    if (!name || name.length < 3 || name.length > 60 || junkPatterns.test(name)) continue;
    if (!allResponses.includes(name.toLowerCase().slice(0, 8))) {
      gaps.push(`Model "${name}" found on website but never mentioned by agent`);
    }
  }

  // Check if GT has prices that agent missed
  const gtHasPrices = gt.models.some(m => m.price);
  const agentHasPrices = agentTest.conversations.some(c =>
    /(?:USD|U\$D|US\$|AR\$|\$)\s*[\d.,]+/i.test(c.response)
  );
  if (gtHasPrices && !agentHasPrices) {
    gaps.push('Website has price information but agent did not provide any prices');
  }

  // Check if GT has PDFs that could be referenced
  if (gt.pdfLinks.length > 0) {
    const agentMentionsPdf = allResponses.includes('pdf') || allResponses.includes('catálogo') || allResponses.includes('catalogo');
    if (!agentMentionsPdf) {
      gaps.push(`Website has ${gt.pdfLinks.length} PDF/catalog links that agent never referenced`);
    }
  }

  // Check model specs vs agent knowledge
  const modelsWithSpecs = gt.models.filter(m => m.m2 || m.rooms);
  const agentGaveSpecs = agentTest.conversations.some(c =>
    /\d+\s*(m2|m²|metros|dormitorio|baño)/i.test(c.response)
  );
  if (modelsWithSpecs.length > 0 && !agentGaveSpecs) {
    gaps.push('Website has model specs (m2, rooms) but agent did not provide specific numbers');
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Main comparison
// ---------------------------------------------------------------------------
export function compareResults(companyName: string): ComparisonResult | null {
  const slug = slugify(companyName);
  const companyDir = path.join(__dirname, slug);
  const gtPath = path.join(companyDir, 'ground-truth.json');
  const agentPath = path.join(companyDir, 'agent-test.json');

  if (!fs.existsSync(gtPath)) {
    console.error(`  No ground-truth.json found for ${companyName}`);
    return null;
  }
  if (!fs.existsSync(agentPath)) {
    console.error(`  No agent-test.json found for ${companyName}`);
    return null;
  }

  const gt: GroundTruthReport = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
  const agentTest: AgentTestResult = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));

  if (agentTest.conversations.length === 0) {
    console.error(`  No conversations in agent test for ${companyName}`);
    return null;
  }

  const corpus = buildGTCorpus(gt);

  // Score each question
  const scores: QuestionScore[] = [];
  for (const conv of agentTest.conversations) {
    const score = scoreQuestion(conv.question, conv.response, conv.saidNoInfo, gt, corpus);
    scores.push(score);
  }

  // Calculate accuracy (correct = 1, partial = 0.5, wrong = 0, not_in_gt = excluded)
  const scoredQuestions = scores.filter(s => s.score !== 'not_in_gt');
  let totalPoints = 0;
  for (const s of scoredQuestions) {
    if (s.score === 'correct') totalPoints += 1;
    else if (s.score === 'partial') totalPoints += 0.5;
  }
  const accuracy = scoredQuestions.length > 0
    ? Math.round((totalPoints / scoredQuestions.length) * 100)
    : 0;

  // Detect gaps
  const keyGaps = detectKeyGaps(gt, agentTest);

  const result: ComparisonResult = {
    company: companyName,
    url: gt.baseUrl,
    groundTruthDate: gt.scannedAt,
    agentTestDate: agentTest.testedAt,
    gtPagesScanned: gt.sections.length + 1, // +1 for homepage
    gtModelsFound: gt.models.length,
    scores,
    accuracy,
    keyGaps,
    summary: `${accuracy}% accuracy on ${scoredQuestions.length} scoreable questions (${scores.length} total)`,
  };

  // Generate markdown
  const md = generateComparisonMarkdown(result);
  const mdPath = path.join(companyDir, 'comparison.md');
  fs.writeFileSync(mdPath, md);
  console.log(`  Saved: ${mdPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// Markdown generator
// ---------------------------------------------------------------------------
function generateComparisonMarkdown(result: ComparisonResult): string {
  let md = `# Comparison Report: ${result.company}\n\n`;
  md += `**URL:** ${result.url}\n`;
  md += `**Ground Truth Date:** ${result.groundTruthDate}\n`;
  md += `**Agent Test Date:** ${result.agentTestDate}\n`;
  md += `**Accuracy:** ${result.accuracy}%\n\n`;

  md += '## Ground Truth Summary\n\n';
  md += `- Pages scanned: ${result.gtPagesScanned}\n`;
  md += `- Models found: ${result.gtModelsFound}\n\n`;

  md += '## Question-by-Question Scoring\n\n';
  md += '| # | Question | Score | Reason |\n';
  md += '|---|----------|-------|--------|\n';
  for (let i = 0; i < result.scores.length; i++) {
    const s = result.scores[i];
    const qShort = s.question.slice(0, 60);
    md += `| ${i + 1} | ${qShort} | ${s.scoreEmoji} ${s.score} | ${s.reason} |\n`;
  }
  md += '\n';

  md += '## Agent Responses\n\n';
  for (let i = 0; i < result.scores.length; i++) {
    const s = result.scores[i];
    md += `### ${i + 1}. ${s.question}\n\n`;
    md += `**Score:** ${s.scoreEmoji} ${s.score} - ${s.reason}\n\n`;
    md += `**Agent said:**\n> ${s.agentResponse.replace(/\n/g, '\n> ')}...\n\n`;
  }

  if (result.keyGaps.length > 0) {
    md += '## Key Gaps\n\n';
    md += 'Information found on the website but missing from agent responses:\n\n';
    for (const gap of result.keyGaps) {
      md += `- ${gap}\n`;
    }
    md += '\n';
  }

  md += `## Summary\n\n`;
  md += `${result.summary}\n`;

  return md;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const { name } = parseArgs();
  const result = compareResults(name);
  if (result) {
    console.log(`\n=== Comparison: ${result.company} ===`);
    console.log(`Accuracy: ${result.accuracy}%`);
    console.log(`Scores: ${result.scores.map(s => s.scoreEmoji).join(' ')}`);
    if (result.keyGaps.length > 0) {
      console.log(`Key gaps: ${result.keyGaps.length}`);
      for (const gap of result.keyGaps) {
        console.log(`  - ${gap}`);
      }
    }
  }
}

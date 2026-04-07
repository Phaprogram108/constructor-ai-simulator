import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import testCompaniesData from './fixtures/test-companies.json';
import testQuestionsData from './fixtures/test-questions.json';
import { evaluateResponse, evaluateCompany, QuestionConfig, CompanyEvaluation } from './helpers/quality-evaluator';
import { generateBatchReport, saveReport } from './helpers/report-generator';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RESULTS_DIR = path.join(__dirname, 'results');

// Configurable timeouts (can be overridden via environment variables)
const FALLBACK_WAIT_MS = parseInt(process.env.FALLBACK_WAIT_MS || '3000', 10);
const DOM_SETTLE_WAIT_MS = parseInt(process.env.DOM_SETTLE_WAIT_MS || '1000', 10);
const BETWEEN_QUESTIONS_WAIT_MS = parseInt(process.env.BETWEEN_QUESTIONS_WAIT_MS || '1500', 10);

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

interface Company {
  id: string;
  name: string;
  websiteUrl: string;
  pdfUrl: string | null;
}

interface ConversationEntry {
  questionId: string;
  question: string;
  response: string;
  timestamp: string;
  screenshotPath: string;
}

// Helper to send message and wait for response
async function sendMessage(page: Page, message: string): Promise<string> {
  // Find and fill textarea
  const textarea = page.locator('textarea');
  await textarea.fill(message);

  // Send message
  await textarea.press('Enter');

  // Wait for response - look for the typing indicator to appear and disappear
  try {
    // Wait for typing indicator
    await page.waitForSelector('.animate-bounce', { timeout: 10000 });
    // Wait for it to disappear (response arrived)
    await page.waitForSelector('.animate-bounce', { state: 'detached', timeout: 60000 });
  } catch {
    // If no typing indicator, just wait a bit (fallback)
    await page.waitForTimeout(FALLBACK_WAIT_MS);
  }

  // Small delay to ensure DOM is updated
  await page.waitForTimeout(DOM_SETTLE_WAIT_MS);

  // Get all assistant messages (messages with the Sofia avatar)
  const assistantMessages = await page.locator('.bg-gray-100.rounded-2xl').all();

  if (assistantMessages.length === 0) {
    throw new Error('No assistant messages found');
  }

  // Get the last message content
  const lastMessage = assistantMessages[assistantMessages.length - 1];
  const messageText = await lastMessage.locator('p.text-sm').textContent();

  return messageText || '';
}

// Helper to create session for a company
async function createSession(page: Page, company: Company): Promise<boolean> {
  await page.goto(BASE_URL);

  // Wait for form to load
  await page.waitForSelector('input#websiteUrl', { timeout: 10000 });

  // Fill website URL
  await page.fill('input#websiteUrl', company.websiteUrl);

  // Submit form
  await page.click('button:has-text("Generar Mi Agente IA")');

  // Wait for redirect to chat (can take up to 60s for scraping)
  try {
    await page.waitForURL('**/demo/**', { timeout: 90000 });
    // Wait for welcome message
    await page.waitForSelector('.bg-gray-100.rounded-2xl', { timeout: 30000 });
    return true;
  } catch (error) {
    console.error(`Failed to create session for ${company.name}:`, error);
    return false;
  }
}

// Run tests for each company
const companies = testCompaniesData.companies as Company[];
const questions = testQuestionsData.questions as QuestionConfig[];

// File-based storage for evaluations (safe for parallel workers)
const EVALUATIONS_FILE = path.join(RESULTS_DIR, '.evaluations-temp.json');

function saveEvaluation(evaluation: CompanyEvaluation): void {
  let evaluations: CompanyEvaluation[] = [];
  try {
    if (fs.existsSync(EVALUATIONS_FILE)) {
      evaluations = JSON.parse(fs.readFileSync(EVALUATIONS_FILE, 'utf-8'));
    }
  } catch {
    evaluations = [];
  }
  evaluations.push(evaluation);
  fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(evaluations, null, 2));
}

function loadAllEvaluations(): CompanyEvaluation[] {
  try {
    if (fs.existsSync(EVALUATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(EVALUATIONS_FILE, 'utf-8'));
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function clearEvaluationsFile(): void {
  try {
    if (fs.existsSync(EVALUATIONS_FILE)) {
      fs.unlinkSync(EVALUATIONS_FILE);
    }
  } catch {
    // Ignore errors
  }
}

for (const company of companies) {
  test.describe(`Company: ${company.name}`, () => {
    let conversation: ConversationEntry[] = [];
    let companyResultsDir: string;

    test.beforeAll(async () => {
      // Create company-specific results directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      companyResultsDir = path.join(RESULTS_DIR, timestamp, company.id);
      fs.mkdirSync(companyResultsDir, { recursive: true });
      fs.mkdirSync(path.join(companyResultsDir, 'screenshots'), { recursive: true });
    });

    test(`Test ${company.name} with all questions`, async ({ page }) => {
      // Step 1: Create session
      test.setTimeout(300000); // 5 minutes total

      console.log(`\n=== Testing: ${company.name} ===`);
      console.log(`URL: ${company.websiteUrl}`);

      const sessionCreated = await createSession(page, company);

      if (!sessionCreated) {
        console.error(`SKIP: Could not create session for ${company.name}`);
        test.skip();
        return;
      }

      // Take initial screenshot
      await page.screenshot({
        path: path.join(companyResultsDir, 'screenshots', '00-welcome.png'),
        fullPage: true,
      });

      // Step 2: Send each question and collect responses
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log(`\n  Q${i + 1}: ${question.question}`);

        try {
          const response = await sendMessage(page, question.question);
          console.log(`  A: ${response.substring(0, 100)}...`);

          // Take screenshot after response
          const screenshotPath = path.join(
            companyResultsDir,
            'screenshots',
            `${String(i + 1).padStart(2, '0')}-${question.id}.png`
          );
          await page.screenshot({ path: screenshotPath, fullPage: true });

          conversation.push({
            questionId: question.id,
            question: question.question,
            response,
            timestamp: new Date().toISOString(),
            screenshotPath,
          });

          // Small delay between questions
          await page.waitForTimeout(BETWEEN_QUESTIONS_WAIT_MS);
        } catch (error) {
          console.error(`  ERROR: Failed to get response for ${question.id}:`, error);
          conversation.push({
            questionId: question.id,
            question: question.question,
            response: 'ERROR: No response received',
            timestamp: new Date().toISOString(),
            screenshotPath: '',
          });
        }
      }

      // Step 3: Save conversation
      fs.writeFileSync(
        path.join(companyResultsDir, 'conversation.json'),
        JSON.stringify(conversation, null, 2)
      );

      // Step 4: Evaluate responses
      console.log('\n  Evaluating responses...');
      const responsesForEvaluation = conversation
        .filter(c => !c.response.startsWith('ERROR'))
        .map(c => {
          const questionConfig = questions.find(q => q.id === c.questionId);
          if (!questionConfig) {
            throw new Error(`Question config not found for id: ${c.questionId}`);
          }
          return {
            questionConfig,
            response: c.response,
          };
        });

      if (responsesForEvaluation.length > 0) {
        const evaluation = await evaluateCompany(
          company.id,
          company.name,
          company.websiteUrl,
          responsesForEvaluation
        );

        // Save evaluation
        fs.writeFileSync(
          path.join(companyResultsDir, 'evaluation.json'),
          JSON.stringify(evaluation, null, 2)
        );

        saveEvaluation(evaluation);

        console.log(`\n  RESULT: ${evaluation.summary}`);
        console.log(`  Status: ${evaluation.passed ? 'PASSED' : 'FAILED'}`);

        // Assert minimum score
        expect(evaluation.averageScore).toBeGreaterThanOrEqual(50);
      }
    });
  });
}

// Generate batch report after all tests
test.afterAll(async () => {
  const allEvaluations = loadAllEvaluations();
  if (allEvaluations.length > 0) {
    console.log('\n=== Generating Batch Report ===');

    const report = generateBatchReport(allEvaluations, {
      baseUrl: BASE_URL,
      questionsPerCompany: questions.length,
    });

    const reportPath = saveReport(report, RESULTS_DIR);
    console.log(`Report saved to: ${reportPath}`);

    console.log('\n=== FINAL SUMMARY ===');
    console.log(`Companies Tested: ${report.summary.companiesTested}`);
    console.log(`Companies Passed: ${report.summary.companiesPassed}`);
    console.log(`Pass Rate: ${report.summary.passRate}%`);
    console.log(`Average Score: ${report.summary.averageScore}/100`);

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      for (const rec of report.recommendations) {
        console.log(`  - ${rec}`);
      }
    }

    // Clean up temp file
    clearEvaluationsFile();
  }
});

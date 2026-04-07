import Anthropic from '@anthropic-ai/sdk';

interface QuestionConfig {
  id: string;
  question: string;
  description: string;
  expectedPatterns: string[];
  antiPatterns: string[];
}

interface EvaluationResult {
  questionId: string;
  question: string;
  response: string;
  scores: {
    specificity: number;    // 30% - Menciona datos concretos
    relevance: number;      // 25% - Responde la pregunta
    noInvention: number;    // 20% - No fabrica datos
    tone: number;           // 15% - Profesional, calido, usa "vos"
    action: number;         // 10% - Intenta calificar lead
  };
  totalScore: number;
  patternMatches: string[];
  antiPatternMatches: string[];
  reasoning: string;
  passed: boolean;
}

interface CompanyEvaluation {
  companyId: string;
  companyName: string;
  websiteUrl: string;
  timestamp: string;
  evaluations: EvaluationResult[];
  averageScore: number;
  passed: boolean;
  summary: string;
}

// Simple pattern-based evaluation (no LLM needed)
function evaluateWithPatterns(
  response: string,
  questionConfig: QuestionConfig
): { patternMatches: string[]; antiPatternMatches: string[] } {
  const normalizedResponse = response.toLowerCase();

  const patternMatches = questionConfig.expectedPatterns.filter(pattern =>
    normalizedResponse.includes(pattern.toLowerCase())
  );

  const antiPatternMatches = questionConfig.antiPatterns.filter(pattern =>
    normalizedResponse.includes(pattern.toLowerCase())
  );

  return { patternMatches, antiPatternMatches };
}

// LLM-based evaluation for deeper analysis
export async function evaluateResponse(
  response: string,
  questionConfig: QuestionConfig,
  companyContext?: string
): Promise<EvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for quality evaluation');
  }
  const anthropic = new Anthropic({ apiKey });

  const { patternMatches, antiPatternMatches } = evaluateWithPatterns(response, questionConfig);

  const evaluationPrompt = `Evalua esta respuesta de un agente de ventas de una constructora argentina.

PREGUNTA DEL CLIENTE: "${questionConfig.question}"
DESCRIPCION ESPERADA: ${questionConfig.description}

RESPUESTA DEL AGENTE:
"${response}"

Evalua usando estos criterios (0-100 cada uno):

1. ESPECIFICIDAD (30%):
   - 90-100: Menciona nombres de modelos, m2 exactos, precios especificos
   - 70-89: Menciona algunos datos concretos pero faltan detalles
   - 50-69: Respuesta generica con pocos datos
   - 0-49: No menciona datos concretos

2. RELEVANCIA (25%):
   - 90-100: Responde exactamente lo que se pregunto
   - 70-89: Responde la pregunta pero con informacion extra innecesaria
   - 50-69: Respuesta parcialmente relacionada
   - 0-49: No responde la pregunta

3. NO INVENCION (20%):
   - 100: No inventa datos, admite cuando no sabe
   - 70-99: Posible informacion inferida pero razonable
   - 0-69: Parece inventar datos o dar informacion falsa

4. TONO (15%):
   - 90-100: Profesional, calido, usa "vos", amigable
   - 70-89: Correcto pero algo frio o formal
   - 50-69: Demasiado formal o impersonal
   - 0-49: Tono inapropiado

5. ACCION (10%):
   - 90-100: Intenta calificar el lead (pide datos, ofrece contacto)
   - 70-89: Sugiere siguiente paso vagamente
   - 50-69: No propone accion clara
   - 0-49: Cierra la conversacion sin accion

Responde SOLO con JSON valido (sin markdown):
{
  "specificity": <numero>,
  "relevance": <numero>,
  "noInvention": <numero>,
  "tone": <numero>,
  "action": <numero>,
  "reasoning": "<explicacion breve de la evaluacion>"
}`;

  try {
    const result = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: evaluationPrompt }],
    });

    const content = result.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const scores = JSON.parse(jsonMatch[0]);

    // Validate required score fields
    const requiredFields = ['specificity', 'relevance', 'noInvention', 'tone', 'action'];
    for (const field of requiredFields) {
      if (typeof scores[field] !== 'number' || scores[field] < 0 || scores[field] > 100) {
        throw new Error(`Invalid or missing score field: ${field}`);
      }
    }

    // Calculate weighted total
    const totalScore = Math.round(
      (scores.specificity * 0.30) +
      (scores.relevance * 0.25) +
      (scores.noInvention * 0.20) +
      (scores.tone * 0.15) +
      (scores.action * 0.10)
    );

    return {
      questionId: questionConfig.id,
      question: questionConfig.question,
      response,
      scores: {
        specificity: scores.specificity,
        relevance: scores.relevance,
        noInvention: scores.noInvention,
        tone: scores.tone,
        action: scores.action,
      },
      totalScore,
      patternMatches,
      antiPatternMatches,
      reasoning: scores.reasoning,
      passed: totalScore >= 70 && antiPatternMatches.length === 0,
    };
  } catch (error) {
    console.error('Error evaluating response:', error);

    // Fallback to pattern-based scoring
    const patternScore = Math.min(100, patternMatches.length * 20);
    const antiPatternPenalty = antiPatternMatches.length * 30;
    const fallbackScore = Math.max(0, patternScore - antiPatternPenalty);

    return {
      questionId: questionConfig.id,
      question: questionConfig.question,
      response,
      scores: {
        specificity: fallbackScore,
        relevance: fallbackScore,
        noInvention: antiPatternMatches.length === 0 ? 100 : 50,
        tone: 70,
        action: 50,
      },
      totalScore: fallbackScore,
      patternMatches,
      antiPatternMatches,
      reasoning: 'Evaluacion basada en patrones (LLM no disponible)',
      passed: fallbackScore >= 70 && antiPatternMatches.length === 0,
    };
  }
}

export async function evaluateCompany(
  companyId: string,
  companyName: string,
  websiteUrl: string,
  responses: Array<{ questionConfig: QuestionConfig; response: string }>
): Promise<CompanyEvaluation> {
  const evaluations: EvaluationResult[] = [];

  for (const { questionConfig, response } of responses) {
    const evaluation = await evaluateResponse(response, questionConfig);
    evaluations.push(evaluation);

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (evaluations.length === 0) {
    return {
      companyId,
      companyName,
      websiteUrl,
      timestamp: new Date().toISOString(),
      evaluations: [],
      averageScore: 0,
      passed: false,
      summary: 'Score: 0/100 | 0/0 preguntas aprobadas (sin evaluaciones)',
    };
  }

  const averageScore = Math.round(
    evaluations.reduce((sum, e) => sum + e.totalScore, 0) / evaluations.length
  );

  const passedQuestions = evaluations.filter(e => e.passed).length;
  const totalQuestions = evaluations.length;

  return {
    companyId,
    companyName,
    websiteUrl,
    timestamp: new Date().toISOString(),
    evaluations,
    averageScore,
    passed: averageScore >= 70 && passedQuestions >= totalQuestions * 0.8,
    summary: `Score: ${averageScore}/100 | ${passedQuestions}/${totalQuestions} preguntas aprobadas`,
  };
}

export type { QuestionConfig, EvaluationResult, CompanyEvaluation };

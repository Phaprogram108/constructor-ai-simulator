# Plan: Sistema de Testeo para Constructor AI Simulator

## Objetivo
Crear sistema automatizado con Playwright para testear el simulador IA gratuito con múltiples constructoras, evaluar calidad de respuestas vs gold standard (Sofía de ViBert), e iterar hasta lograr calidad consistente.

---

## 1. Estructura del Sistema de Testeo

```
constructor-ai-simulator/
  tests/
    e2e/
      playwright.config.ts           # Config Playwright
      simulator.spec.ts              # Tests principales
      run-batch-test.ts              # Runner de batches
      fixtures/
        test-companies.json          # Empresas a testear
        test-questions.json          # Preguntas estándar
      helpers/
        google-sheets.ts             # Leer empresas del Sheet
        quality-evaluator.ts         # Evaluar respuestas con LLM
        report-generator.ts          # Generar reportes
      results/
        [timestamp]/
          [empresa]/
            conversation.json        # Conversación completa
            screenshots/             # Capturas por respuesta
            evaluation.json          # Scores
          summary-report.json        # Resumen del batch
```

---

## 2. Preguntas de Testeo (basadas en ViBert)

| ID | Pregunta | Qué evalúa |
|----|----------|------------|
| models_list | "¿Qué modelos tienen?" | Debe listar modelos con m² y dormitorios |
| specific_price | "¿Cuánto cuesta el modelo más chico?" | Debe dar precio o pedir ubicación |
| location | "¿Construyen en Córdoba?" | Debe responder sí/no con explicación |
| obra_gris | "¿Qué incluye la obra gris?" | Debe detallar qué incluye y qué no |
| financing | "¿Tienen financiamiento?" | Debe explicar opciones de pago |
| recommendation | "Quiero casa de 2 dormitorios" | Debe recomendar modelos específicos |

---

## 3. Métricas de Evaluación

| Métrica | Peso | Descripción |
|---------|------|-------------|
| Especificidad | 30% | Menciona datos concretos (nombres, m², precios) |
| Relevancia | 25% | Responde directamente la pregunta |
| No Invención | 20% | No fabrica datos inexistentes |
| Tono | 15% | Profesional, cálido, usa "vos" |
| Acción | 10% | Intenta calificar lead o avanzar |

**Criterios de éxito:**
- Score promedio >= 70 por empresa
- >= 80% de empresas pasan umbral
- 0 respuestas inventando datos

---

## 4. Fuente de Empresas

**Google Sheet:** `1GVt0MqKgc5psukWdJLMFLdTlLFdOh5wFcaLGcqUElEE`
- Tab: `MASTER`
- Extraer URLs de sitios web desde perfiles de Instagram
- Credenciales: `~/Desktop/pha-scraper/credentials.json`

**Alternativa:** Crear `test-companies.json` manual con 5 empresas iniciales.

---

## 5. Proceso de Testeo

### Fase 1: Setup
1. Instalar Playwright: `npm install -D @playwright/test && npx playwright install chromium`
2. Crear estructura de carpetas `tests/e2e/`
3. Crear archivos de fixtures (preguntas, empresas)

### Fase 2: Test Inicial (5 empresas)
1. Ejecutar tests con 5 empresas
2. Capturar screenshots en cada respuesta
3. Evaluar calidad con Claude Haiku
4. Generar reporte

### Fase 3: Análisis y Mejoras
Si score < 70, identificar causa:
- **Scraping falla** → Mejorar `scraper.ts`
- **PDF no se lee** → Mejorar `pdf-extractor.ts`
- **Respuestas genéricas** → Mejorar `prompt-generator.ts`

### Fase 4: Iteración
1. Aplicar mejoras
2. Re-testear mismas 5 empresas
3. Si pasa → expandir a 10, luego 25, luego 50
4. Objetivo final: 50 empresas con score >= 70

---

## 6. Archivos Críticos a Modificar

| Archivo | Cuándo modificar |
|---------|------------------|
| `src/lib/scraper.ts` | Si no extrae modelos/precios del sitio web |
| `src/lib/pdf-extractor.ts` | Si no lee bien el catálogo PDF |
| `src/lib/prompt-generator.ts` | Si respuestas son genéricas o tono incorrecto |
| `src/app/api/chat/route.ts` | Si modelo GPT está mal (`gpt-5.1` → `gpt-4o`) |

---

## 7. Verificación

1. **Durante desarrollo:** `npx playwright test --headed` (ver navegador)
2. **Batch testing:** `npx playwright test` (headless)
3. **Ver resultados:** `cat tests/e2e/results/[timestamp]/summary-report.json`
4. **Éxito:** 50 empresas testeadas con score >= 70 promedio

---

## 8. Tareas de Implementación

1. [ ] Crear `tests/e2e/playwright.config.ts`
2. [ ] Crear `tests/e2e/fixtures/test-questions.json`
3. [ ] Crear `tests/e2e/fixtures/test-companies.json` (5 empresas inicial)
4. [ ] Crear `tests/e2e/helpers/quality-evaluator.ts`
5. [ ] Crear `tests/e2e/helpers/report-generator.ts`
6. [ ] Crear `tests/e2e/simulator.spec.ts` (test principal)
7. [ ] Crear `tests/e2e/run-batch-test.ts` (runner de batches)
8. [ ] Ejecutar primer batch de 5 empresas
9. [ ] Analizar resultados e iterar
10. [ ] Expandir hasta 50 empresas

---

## 9. Código de Referencia

### Test Principal (simulator.spec.ts)

```typescript
import { test, expect, Page } from '@playwright/test';
import testCompanies from './fixtures/test-companies.json';
import testQuestions from './fixtures/test-questions.json';

const BASE_URL = 'https://constructor-ai-simulator.vercel.app/';

async function sendMessage(page: Page, message: string): Promise<string> {
  const textarea = page.locator('textarea');
  await textarea.fill(message);
  await textarea.press('Enter');
  await page.waitForTimeout(5000);

  const messages = await page.locator('[data-role="assistant"]').all();
  const lastMessage = messages[messages.length - 1];
  return await lastMessage.textContent() || '';
}

for (const company of testCompanies) {
  test(`Test: ${company.name}`, async ({ page }) => {
    // 1. Crear sesión
    await page.goto(BASE_URL);
    await page.fill('input[id="websiteUrl"]', company.websiteUrl);
    await page.click('text=Generar Mi Agente IA');

    // 2. Esperar chat
    await page.waitForSelector('text=Hola', { timeout: 60000 });

    // 3. Enviar preguntas
    for (const q of testQuestions.questions) {
      const response = await sendMessage(page, q.question);
      await page.screenshot({ path: `results/${company.name}/${q.id}.png` });

      // Evaluar y guardar
      console.log(`${q.id}: ${response.substring(0, 100)}...`);
    }
  });
}
```

### Evaluador de Calidad (quality-evaluator.ts)

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function evaluateResponse(response: string, question: any) {
  const anthropic = new Anthropic();

  const prompt = `Evalua esta respuesta de un agente de ventas de constructora.

PREGUNTA: "${question.question}"
RESPUESTA: "${response}"

Criterios:
- Especificidad (0-100): ¿Menciona datos concretos?
- Relevancia (0-100): ¿Responde la pregunta?
- Tono (0-100): ¿Profesional y cálido?

Responde SOLO JSON: {"score": N, "specificity": N, "relevance": N, "tone": N, "reasoning": "..."}`;

  const result = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(result.content[0].text.match(/\{[\s\S]*\}/)?.[0] || '{}');
}
```

### Fixture de Preguntas (test-questions.json)

```json
{
  "questions": [
    {
      "id": "models_list",
      "question": "¿Qué modelos tienen?",
      "expectedPatterns": ["m²", "dormitorios", "modelo"],
      "antiPatterns": ["no tengo", "no dispongo"]
    },
    {
      "id": "specific_price",
      "question": "¿Cuánto cuesta el modelo más chico?",
      "expectedPatterns": ["$", "USD", "precio", "ubicación"],
      "antiPatterns": ["no puedo", "no tengo información"]
    },
    {
      "id": "location",
      "question": "¿Construyen en Córdoba?",
      "expectedPatterns": ["sí", "no", "zona"],
      "antiPatterns": ["no sé"]
    },
    {
      "id": "obra_gris",
      "question": "¿Qué incluye la obra gris?",
      "expectedPatterns": ["incluye", "no incluye", "estructura"],
      "antiPatterns": ["no sé", "no tengo información"]
    },
    {
      "id": "financing",
      "question": "¿Tienen financiamiento?",
      "expectedPatterns": ["cuotas", "pago", "contado"],
      "antiPatterns": ["no sé"]
    },
    {
      "id": "recommendation",
      "question": "Quiero una casa de 2 dormitorios",
      "expectedPatterns": ["modelo", "m²", "recomiendo"],
      "antiPatterns": ["no tengo"]
    }
  ]
}
```

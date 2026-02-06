# V4 Exploratory Spec - Constructor AI Simulator

**Fecha:** 2026-02-06
**Objetivo:** Eliminar la clasificacion rigida de constructoras y hacer que el sistema explore y se adapte a lo que cada empresa realmente ofrece.

---

## Resumen Ejecutivo

El sistema actual asume que toda constructora encaja en 4 categorias (MODULAR/TRADICIONAL/MIXTA/INMOBILIARIA) y usa schemas fijos para extraer datos. V4 elimina esta clasificacion y hace que el scraper explore sin prejuicios, el prompt se adapte a lo encontrado, y el pipeline diagnostico evalúe contra datos exploratorios.

**Archivos principales a modificar:**
- `src/types/index.ts` - Nuevo formato ScrapedContent
- `src/lib/firecrawl.ts` - Scraper exploratorio
- `src/lib/prompt-generator.ts` - Template unico adaptativo
- `src/lib/scraper.ts` - Eliminar uso de constructoraType
- `src/app/api/simulator/create/route.ts` - Actualizar para nuevo formato
- `scripts/agent-test.ts` - Preguntas dinamicas
- `scripts/diagnosis.ts` - Evaluacion exploratoria
- `scripts/ground-truth-capture.ts` - Ajustes menores

---

## 5 Empresas para Test Inicial

Seleccionadas por variedad de tipo, complejidad, y problemas conocidos:

| # | Empresa | URL | Por que | Tipo esperado |
|---|---------|-----|---------|---------------|
| 1 | **ViBert** | vibert.com.ar | Modular grande, muchos modelos, linktree | Catalogo con modelos |
| 2 | **Grupo Steimberg** | gruposteimberg.com | Clasificada mal como modular, es tradicional | Servicios a medida |
| 3 | **Lista** | lista.com.ar | Inmobiliaria/desarrolladora | Proyectos inmobiliarios |
| 4 | **PlugArq** | plugarq.com | SPA pesada, timeout frecuente | SPA modular |
| 5 | **Habika** | habika.ar | Aleratoria sin issues conocidos | Sin prejuicios |

Estas 5 cubren: catalogo grande, servicios a medida, inmobiliaria, SPA problematica, y empresa "normal".

---

## Fase 1: Nuevos Tipos TypeScript

**Dependencias:** Ninguna
**Complejidad:** Baja
**Archivos a modificar:**
- `src/types/index.ts`

### Nuevo ScrapedContent

```typescript
// REEMPLAZA la interface ScrapedContent existente

export interface ProductOrService {
  name: string;
  description?: string;
  specs: Record<string, string | number>; // {m2: 65, dormitorios: 2, precio: "USD 45.000"}
  features?: string[];
  category?: string; // La terminologia de la empresa: "modelo", "tipologia", "proyecto", "unidad", etc.
}

export interface CompanyProfile {
  identity: string;        // Que ES la empresa (1-2 oraciones)
  offering: string;        // Que OFRECE (1-2 oraciones)
  differentiators: string; // Que la hace DIFERENTE (1-2 oraciones)
  terminology: {           // Como llama la empresa a sus cosas
    productsLabel: string; // "modelos", "tipologias", "proyectos", "servicios", "unidades"
    processLabel: string;  // "construccion", "desarrollo", "diseno"
  };
}

export interface ScrapedContent {
  title: string;
  description: string;
  profile: CompanyProfile;
  products: ProductOrService[];  // REEMPLAZA models: string[]
  services: string[];
  contactInfo: string;
  rawText: string;
  faqs?: { question: string; answer: string }[];
  socialLinks?: SocialLinks;
  // constructoraType ELIMINADO
}
```

### Tareas

1. [ ] Agregar interfaces `ProductOrService` y `CompanyProfile` a `src/types/index.ts`
2. [ ] Modificar `ScrapedContent`: quitar `constructoraType`, quitar `models: string[]`, agregar `profile: CompanyProfile` y `products: ProductOrService[]`
3. [ ] Agregar `models?: string[]` como campo deprecated opcional con comment `@deprecated Use products instead - se mantiene para backwards compatibility durante la migracion`

### Notas de migracion

Durante la transicion, `models` sigue existiendo como campo opcional deprecated. Esto permite que partes del sistema que aun no migraron sigan funcionando. Se elimina completamente al final de V4.

---

## Fase 2: Scraper Exploratorio (firecrawl.ts)

**Dependencias:** Fase 1
**Complejidad:** Alta (archivo mas grande y critico)
**Archivos a modificar:**
- `src/lib/firecrawl.ts`

### Que ELIMINAR

1. `classifyConstructora()` funcion completa (~250 lineas, lineas 895-1122)
2. `ConstructoraClassification` interface (lineas 876-886)
3. `catalogSchema` - el zod schema fijo con `models[]{name, sqMeters, bedrooms...}` y `quinchos` (lineas 324-349)
4. `singleModelSchema` (lineas 352-365)
5. `parseModelsFromMarkdown()` - regex patterns fijos para modelos (lineas 391-498)
6. `AGENT_EXTRACTION_PROMPT` y `WIX_AGENT_PROMPT` - prompts que buscan "modelos de casas" (lineas 73-140)
7. La llamada a `classifyConstructora()` en `scrapeWithFirecrawl()` (lineas 1509-1517)
8. `formatModelString()` que formatea como "Casa X - 65m2 - 2 dorm" (lineas 1610-1642)

### Que AGREGAR

#### Nuevo extract schema exploratorio

```typescript
const exploratorySchema = z.object({
  companyName: z.string().optional().describe("Nombre comercial de la empresa"),
  identity: z.string().optional().describe("Que es la empresa y a que se dedica, en 1-2 oraciones"),
  offering: z.string().optional().describe("Que productos o servicios ofrece la empresa"),
  differentiators: z.string().optional().describe("Que la diferencia de la competencia"),
  productsTerminology: z.string().optional().describe("Como llama la empresa a sus productos: modelos, tipologias, proyectos, unidades, servicios, etc"),
  products: z.array(z.object({
    name: z.string().describe("Nombre tal como aparece en el sitio"),
    description: z.string().optional().describe("Descripcion del producto/servicio"),
    specs: z.record(z.union([z.string(), z.number()])).optional()
      .describe("Especificaciones: m2, dormitorios, banos, precio, etc - las keys son las que use el sitio"),
    features: z.array(z.string()).optional().describe("Caracteristicas incluidas"),
    category: z.string().optional().describe("Categoria segun el sitio: casa, quincho, loft, departamento, lote, etc"),
  })).optional().describe("TODOS los productos/servicios que ofrece la empresa"),
  contactPhone: z.string().optional(),
  contactWhatsapp: z.string().optional(),
  contactEmail: z.string().optional(),
  locations: z.array(z.string()).optional(),
  constructionMethod: z.string().optional(),
  financing: z.string().optional().describe("Info de financiacion si existe"),
});
```

#### Nuevo prompt de extraccion

```typescript
const EXPLORATORY_EXTRACTION_PROMPT = `Sos un experto extrayendo informacion de sitios web de empresas.

NO asumas que tipo de empresa es. Explora y descubri:

1. QUE ES la empresa y a que se dedica
2. QUE OFRECE: productos, servicios, proyectos - lo que sea que venda
3. Para cada producto/servicio: nombre, descripcion, especificaciones (las que haya)
4. COMO llama la empresa a sus productos (modelos? tipologias? proyectos? servicios?)
5. Informacion de contacto: WhatsApp, telefono, email
6. FAQs si hay
7. Diferenciadores: que la hace unica

IMPORTANTE:
- NO asumas que hay "modelos de casas" - puede vender servicios, lotes, departamentos, o lo que sea
- Usa la TERMINOLOGIA que usa el sitio, no la tuya
- Navega por todas las secciones
- Expande elementos colapsables
- Extrae SOLO lo que existe, no inventes`;
```

#### Flujo modificado de `scrapeWithFirecrawl()`

El flujo de 5 pasos se mantiene similar pero con el nuevo schema:

```
STEP 1: Crawl (sin cambios - solo recolecta markdown)
STEP 2: Scrape homepage con exploratorySchema (reemplaza catalogSchema)
STEP 2.5: mapUrl fallback (sin cambios en logica, pero ya no filtra por MODEL_KEYWORDS exclusivamente)
STEP 3: extract() API con nuevo prompt (exploratorio)
STEP 4: Agent fallback con EXPLORATORY_EXTRACTION_PROMPT
STEP 5: Finalize - construye ScrapedContent con CompanyProfile + ProductOrService[]
```

**Cambio clave en STEP 2.5 (mapUrl fallback):** Expandir `MODEL_KEYWORDS` a `PRODUCT_KEYWORDS` que incluya tambien: `servicio`, `obra`, `emprendimiento`, `desarrollo`, `lote`, `departamento`, `unidad`, `torre`, `barrio`.

#### Nueva funcion de retorno

```typescript
// REEMPLAZA el return actual de scrapeWithFirecrawl()
return {
  title: companyName,
  description: companyDescription,
  profile: {
    identity: extractedIdentity || companyDescription,
    offering: extractedOffering || '',
    differentiators: extractedDifferentiators || '',
    terminology: {
      productsLabel: extractedTerminology || inferTerminology(products),
      processLabel: inferProcess(combinedMarkdown),
    },
  },
  products: allProducts,  // ProductOrService[]
  services: buildServices(constructionMethod, hasFinancing, locations),
  contactInfo: formatContactInfo(contactInfo),
  rawText: combinedMarkdown.slice(0, 20000),
  faqs: faqs.length > 0 ? faqs : undefined,
  socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
  // SIN constructoraType
};
```

### Tareas

1. [ ] Crear `exploratorySchema` y `EXPLORATORY_EXTRACTION_PROMPT` al inicio del archivo
2. [ ] Eliminar `classifyConstructora()`, `ConstructoraClassification`, `catalogSchema`, `singleModelSchema`, `parseModelsFromMarkdown()`, `formatModelString()`, `AGENT_EXTRACTION_PROMPT`, `WIX_AGENT_PROMPT`
3. [ ] Modificar `scrapeWithFirecrawl()` para usar el nuevo schema y retornar el nuevo formato

### Que MANTENER sin cambios

- `extractWhatsAppImproved()` - sigue util
- `extractSocialLinks()` - sigue util
- `extractFAQContent()` - sigue util
- `isWixSite()` - sigue util (lo usa el fallback)
- `mergeModels()` / `deduplicateModels()` - adaptar para ProductOrService
- `scrapeWithAgent()` / `scrapeWixSite()` - adaptar prompts internos
- `parseAgentModels/Contact/FAQs` - adaptar para formato exploratorio
- `UNIVERSAL_ACTIONS` - se mantienen

---

## Fase 3: Prompt Generator Adaptativo (prompt-generator.ts)

**Dependencias:** Fase 1, Fase 2
**Complejidad:** Media
**Archivos a modificar:**
- `src/lib/prompt-generator.ts`

### Que ELIMINAR

1. Toda la logica condicional basada en `constructoraType` (lineas 28-29, 52-162, 241-318)
2. Los 4 templates diferentes (MODULAR, TRADICIONAL, INMOBILIARIA, MIXTA)
3. Las instrucciones de calificacion por tipo (lineas 241-318)
4. La referencia a `**Tipo de Constructora**: ${constructoraType.toUpperCase()}` (linea 332)

### Que AGREGAR

Un **unico template adaptativo** que usa la info del `CompanyProfile`:

```typescript
export function generateSystemPromptWithCatalog({ scrapedContent, catalog }: {
  scrapedContent: ScrapedContent;
  catalog?: ExtractedCatalog;
}): string {
  const { title, profile, products, services, contactInfo, rawText } = scrapedContent;

  // Seccion de productos/servicios - se adapta a lo encontrado
  let productsSection = '';
  if (catalog && catalog.models.length > 0) {
    // PDF tiene prioridad (sin cambios en esta parte)
    productsSection = buildCatalogSection(catalog);
  } else if (products.length > 0) {
    productsSection = buildProductsSection(products, profile.terminology.productsLabel);
  } else {
    productsSection = buildNoProductsSection(profile);
  }

  // Instrucciones de calificacion - UNICAS, adaptadas por profile
  const qualificationInstructions = buildQualificationInstructions(profile);

  return `Sos Sofia, asesora comercial de ${title}. Sos una vendedora experta...

## SOBRE LA EMPRESA
${profile.identity}

## QUE OFRECEMOS
${profile.offering}

## DIFERENCIADORES
${profile.differentiators}

${productsSection}
${qualificationInstructions}
...`;
}
```

#### Helper: buildProductsSection()

```typescript
function buildProductsSection(
  products: ProductOrService[],
  label: string  // "modelos", "tipologias", "proyectos", etc
): string {
  const header = label.charAt(0).toUpperCase() + label.slice(1);

  return `
## ${header.toUpperCase()} DISPONIBLES

${products.map((p, i) => {
  const specs = Object.entries(p.specs || {})
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n');
  const features = p.features?.length ? `- **Incluye**: ${p.features.join(', ')}` : '';
  return `### ${i + 1}. ${p.name}${p.description ? `\n${p.description}` : ''}
${specs}
${features}`;
}).join('\n\n')}

**IMPORTANTE**: Cuando pregunten por ${label}, SIEMPRE menciona estos nombres especificos.
`;
}
```

#### Helper: buildQualificationInstructions()

```typescript
function buildQualificationInstructions(profile: CompanyProfile): string {
  const { productsLabel, processLabel } = profile.terminology;

  return `
## FLUJO DE CALIFICACION

Tu objetivo es entender que necesita el cliente y conectarlo con lo que ofrecemos.

### Preguntas para calificar (UNA A LA VEZ):
1. "Que tipo de ${productsLabel} estas buscando?"
2. "Ya tenes terreno? En que zona?"
3. "Para cuando lo necesitarias?"
4. "Que presupuesto manejas aproximadamente?"
5. "Queres que te contacte un asesor para avanzar?"

### Estrategia:
- Si tenemos ${productsLabel} que encajen, mostralos
- Si ninguno encaja, ofrece alternativas o contacto directo
- Si no tenemos ${productsLabel} predefinidos, entende las necesidades del cliente
- Siempre ofrece agendar reunion si el lead esta calificado
`;
}
```

### Tareas

1. [ ] Reescribir `generateSystemPromptWithCatalog()` con template unico que usa `profile` y `products`
2. [ ] Crear helpers: `buildProductsSection()`, `buildNoProductsSection()`, `buildQualificationInstructions()`
3. [ ] Eliminar toda referencia a `constructoraType`

---

## Fase 4: Actualizar Scraper Wrapper y API Route

**Dependencias:** Fase 1, Fase 2, Fase 3
**Complejidad:** Baja
**Archivos a modificar:**
- `src/lib/scraper.ts`
- `src/app/api/simulator/create/route.ts`

### scraper.ts

- **Eliminar:** `firecrawlClassification` variable y toda la logica de preservar/restaurar `constructoraType` (lineas 75-76, 82-87, 116-119)
- **Adaptar:** `mergeVisionResults()` para trabajar con `ProductOrService[]` en lugar de `models: string[]`
- **Adaptar:** `needsVisionScraping()` - en vez de chequear `models.length`, chequear `products.length`
- **Mantener:** El flujo general (Firecrawl -> Playwright -> basic fetch -> Vision -> Linktree)

### create/route.ts

- **Eliminar:** `constructoraType` del log de `createEnhancedLog()` (linea 143)
- **Adaptar:** Los logs para mostrar `products` en lugar de `models`
- **Cambio en la respuesta:** Ya no incluir `constructoraType` en la metadata

### Tareas

1. [ ] Limpiar `scraper.ts` de toda referencia a `constructoraType`
2. [ ] Adaptar `mergeVisionResults()` para nuevo formato
3. [ ] Limpiar `create/route.ts` de constructoraType

---

## Fase 5: Pipeline Diagnostico - Agent Test

**Dependencias:** Fase 1 (para entender nuevos tipos)
**Complejidad:** Media
**Archivos a modificar:**
- `scripts/agent-test.ts`

### Cambio principal: preguntas dinamicas por empresa

Reemplazar `generateQuestions()` (lineas 324-348) que tiene preguntas hardcodeadas:

```typescript
// ACTUAL (rigido):
function generateQuestions(groundTruth: GroundTruth | null): Question[] {
  const questions: Question[] = [
    { text: '?Que modelos tienen disponibles?', type: 'base' },
    { text: '?Cuantos modelos/proyectos ofrecen?', type: 'base' },
    { text: '?Cuanto cuesta el modelo mas economico?', type: 'base' },
    // ...hardcoded
  ];
}

// NUEVO (exploratorio):
function generateQuestions(groundTruth: GroundTruthData | null): Question[] {
  const questions: Question[] = [];

  // 1. Preguntas universales (siempre se hacen)
  questions.push(
    { text: 'Que es tu empresa y que hacen?', type: 'identity' },
    { text: 'Que productos o servicios ofrecen?', type: 'offering' },
    { text: 'Cual es su WhatsApp o telefono de contacto?', type: 'contact' },
  );

  // 2. Preguntas basadas en lo encontrado en ground truth
  if (!groundTruth) return questions;

  // Si hay productos/modelos
  if (groundTruth.models && groundTruth.models.length > 0) {
    questions.push({
      text: `Cuantos ${inferProductLabel(groundTruth)} ofrecen?`,
      type: 'product_count',
    });

    // Preguntar por hasta 3 productos especificos
    const modelsToAsk = groundTruth.models.slice(0, 3);
    for (const model of modelsToAsk) {
      questions.push({
        text: `Contame sobre el ${model.name}`,
        type: 'product_specific',
      });
      if (model.sqMeters || model.price) {
        questions.push({
          text: `Cuales son las especificaciones del ${model.name}?`,
          type: 'product_specs',
        });
      }
    }
  }

  // Si tiene financiacion
  if (groundTruth.financing || hasFinancingMention(groundTruth)) {
    questions.push({
      text: 'Tienen financiamiento o planes de pago?',
      type: 'financing',
    });
  }

  // Si tiene cobertura geografica
  if (groundTruth.coverage) {
    questions.push({
      text: 'A que zonas llegan o donde operan?',
      type: 'coverage',
    });
  }

  return questions;
}
```

### Cambio secundario: question types

Expandir el tipo `questionType` de `'base' | 'model_specific'` a:

```typescript
type QuestionType =
  | 'identity'          // Que es la empresa
  | 'offering'          // Que ofrece
  | 'contact'           // Contacto
  | 'product_count'     // Cuantos productos tiene
  | 'product_specific'  // Sobre un producto especifico
  | 'product_specs'     // Specs de un producto
  | 'financing'         // Financiacion
  | 'coverage'          // Cobertura geografica
  | 'differentiator';   // Que los diferencia
```

### Tareas

1. [ ] Reescribir `generateQuestions()` para ser dinamica basada en ground truth
2. [ ] Expandir `QuestionType` con los nuevos tipos
3. [ ] Adaptar `extractModelsFromPrompt()` para detectar productos en el nuevo formato del prompt

---

## Fase 6: Pipeline Diagnostico - Diagnosis

**Dependencias:** Fase 5
**Complejidad:** Media
**Archivos a modificar:**
- `scripts/diagnosis.ts`

### Cambios principales

#### 1. Score ya no basado solo en modelos

```typescript
// ACTUAL:
// overallScore = matchedModels / gtModelCount * 100

// NUEVO: Score compuesto
interface ScoreBreakdown {
  productCoverage: number;    // % de productos del GT mencionados por el agente
  specAccuracy: number;       // % de specs correctas
  contactAccuracy: number;    // Contacto correcto? (0 o 100)
  hallucinationPenalty: number; // -10 por cada hallucination
  identityMatch: number;      // El agente entiende que es la empresa? (0-100)
}

function calculateScore(breakdown: ScoreBreakdown): number {
  const weights = {
    productCoverage: 0.35,
    specAccuracy: 0.20,
    contactAccuracy: 0.15,
    hallucinationPenalty: 0.15,  // penalty, no weight
    identityMatch: 0.15,
  };

  const base = (
    breakdown.productCoverage * weights.productCoverage +
    breakdown.specAccuracy * weights.specAccuracy +
    breakdown.contactAccuracy * weights.contactAccuracy +
    breakdown.identityMatch * weights.identityMatch
  );

  return Math.max(0, Math.round(base - breakdown.hallucinationPenalty));
}
```

#### 2. Nuevos tipos de gap

```typescript
type GapType =
  | 'SCRAPING_MISS'     // Dato en GT no llego al scraper
  | 'PROMPT_MISS'       // Dato en prompt pero agente no lo comunico
  | 'HALLUCINATION'     // Agente invento dato
  | 'IDENTITY_MISS'     // Agente no entiende que es la empresa
  | 'TERMINOLOGY_MISS'; // Agente usa terminologia incorrecta
```

#### 3. Detectar identity match

```typescript
function checkIdentityMatch(
  gt: GroundTruthData,
  agentResponses: string
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Si GT dice tipo "inmobiliaria" pero agente habla de "casas modulares"
  if (gt.type === 'inmobiliaria' &&
      agentResponses.toLowerCase().includes('modular')) {
    score -= 50;
    issues.push('Agente menciona "modular" pero empresa es inmobiliaria');
  }

  // Si GT dice tipo "tradicional" pero agente habla de "catalogo de modelos"
  if (gt.type === 'tradicional' &&
      agentResponses.toLowerCase().includes('catalogo de modelos')) {
    score -= 40;
    issues.push('Agente menciona "catalogo" pero empresa es de servicios a medida');
  }

  return { score, issues };
}
```

### Tareas

1. [ ] Implementar `ScoreBreakdown` y `calculateScore()`
2. [ ] Agregar gap types `IDENTITY_MISS` y `TERMINOLOGY_MISS`
3. [ ] Implementar `checkIdentityMatch()` para detectar cuando el agente no entiende la empresa

---

## Fase 7: Ground Truth Capture (ajustes menores)

**Dependencias:** Ninguna (puede correr en paralelo con Fases 1-4)
**Complejidad:** Baja
**Archivos a modificar:**
- `scripts/ground-truth-capture.ts`

### Cambios

El ground truth capture ya es bastante exploratorio (usa Claude Vision). Los ajustes son menores:

1. **Agregar campos al GroundTruthData:**

```typescript
interface GroundTruthData {
  // ... campos existentes ...
  companyProfile?: {
    identity: string;    // Que es la empresa
    offering: string;    // Que ofrece
    terminology: string; // Como llama a sus productos
  };
}
```

2. **Expandir el prompt de Vision para homepage** (linea 423) para que tambien capture:
   - Identidad de la empresa
   - Tipo de productos/servicios (no solo modelos)
   - Terminologia usada

3. **NO cambiar la estructura principal** - el GT ya funciona bien

### Tareas

1. [ ] Agregar `companyProfile` al interface `GroundTruthData`
2. [ ] Expandir el prompt de Vision de homepage para capturar identidad y terminologia

---

## Fase 8: Verificacion End-to-End con 5 Empresas

**Dependencias:** Fases 1-7 completadas
**Complejidad:** Ejecucion + analisis
**NO es codigo** - es correr el pipeline y verificar

### Proceso

1. Correr ground truth para las 5 empresas:
   ```bash
   npx tsx scripts/ground-truth-capture.ts --company "ViBert"
   npx tsx scripts/ground-truth-capture.ts --company "Grupo Steimberg"
   npx tsx scripts/ground-truth-capture.ts --company "Lista"
   npx tsx scripts/ground-truth-capture.ts --company "PlugArq"
   npx tsx scripts/ground-truth-capture.ts --company "Habika"
   ```

2. Levantar el server y correr agent test:
   ```bash
   npm run dev
   npx tsx scripts/agent-test.ts --company "ViBert"
   # ... repetir para cada empresa
   ```

3. Correr diagnosis:
   ```bash
   npx tsx scripts/diagnosis.ts
   ```

4. Evaluar resultados contra criterios de exito (ver seccion abajo)

### Tareas

1. [ ] Correr ground truth para 5 empresas
2. [ ] Correr agent test para 5 empresas
3. [ ] Correr diagnosis y evaluar scores

---

## Tracks Paralelos

```
Track A (Core):     Fase 1 -> Fase 2 -> Fase 3 -> Fase 4
Track B (Pipeline): Fase 5 -> Fase 6
Track C (GT):       Fase 7

Fase 8 requiere que A, B, y C esten completas.
```

- **Track A** y **Track B** son independientes hasta Fase 8
- **Track C** es independiente de todo
- Fase 5 necesita entender los nuevos tipos de Fase 1 (interface solamente, no implementacion)

---

## Nuevo Extract Schema vs Actual - Comparacion

### Actual (catalogSchema)

```
{
  companyName, companyDescription,
  models: [{name, sqMeters, bedrooms, bathrooms, price, features, category}],
  quinchos: [{name, sqMeters, features}],
  contactPhone, contactWhatsapp, contactEmail,
  locations, constructionMethod, financing
}
```

**Problema:** Asume que la empresa tiene "modelos" y "quinchos". Si es una inmobiliaria, no encaja.

### Nuevo (exploratorySchema)

```
{
  companyName, identity, offering, differentiators,
  productsTerminology,
  products: [{name, description, specs: {key: value}, features, category}],
  contactPhone, contactWhatsapp, contactEmail,
  locations, constructionMethod, financing
}
```

**Diferencia clave:** `specs` es un `Record<string, string|number>` - las keys no son fijas. El sitio puede tener "m2", "ambientes", "pisos", "lotes", "unidades disponibles", o lo que sea. El schema no asume.

---

## Criterios de Exito

### Score minimo por empresa

| Empresa | Score minimo V4 | Comparacion con V3 |
|---------|-----------------|---------------------|
| ViBert | >= 60% | Debe mantener o mejorar cobertura de modelos |
| Grupo Steimberg | >= 70% | V3 lo clasificaba mal - V4 debe entender que es tradicional |
| Lista | >= 60% | V3 probablemente lo trataba como modular - V4 debe entender proyectos |
| PlugArq | >= 50% | SPA problematica, pero debe entender que ofrece |
| Habika | >= 60% | Baseline - no debe empeorar |

### Metricas globales

1. **Score promedio >= 60%** para las 5 empresas
2. **0 identity misses**: Ningun agente debe confundir el tipo de empresa
3. **0 hallucinations de tipo**: No decir "modelos" a una inmobiliaria, no decir "proyectos" a una modular
4. **Terminology correcta**: El agente debe usar la terminologia de la empresa
5. **Contact coverage >= 80%**: Al menos 4/5 empresas con contacto correcto

### Que es peor que V3 (red flags)

- Si alguna empresa que V3 tenia bien baja a <40% en V4
- Si aparecen hallucinations nuevas que V3 no tenia
- Si el prompt generado es >30% mas largo (ineficiencia)
- Si el scraping tarda >50% mas

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Schema exploratorio extrae menos datos que el fijo | Alta | Alto | Comparar output lado a lado para las 5 empresas antes de mergear |
| Prompt unico es menos preciso que 4 templates | Media | Alto | El template unico tiene la info del profile - si el profile es bueno, el prompt sera bueno |
| LLM de extraccion (Firecrawl) no entiende "exploratorio" | Media | Medio | El prompt de extraccion es muy explicito sobre que buscar |
| Ground truth capture no captura terminologia | Baja | Bajo | Agregar campo simple al prompt de Vision |
| Regression en empresas que ya funcionaban bien | Media | Alto | Correr V3 y V4 en paralelo para las 5 empresas y comparar |

---

## Orden de Implementacion Recomendado

```
Dia 1: Fase 1 (tipos) + Fase 7 (GT ajustes) en paralelo
Dia 2: Fase 2 (scraper - es la mas grande)
Dia 3: Fase 3 (prompt generator) + Fase 5 (agent test) en paralelo
Dia 4: Fase 4 (wiring) + Fase 6 (diagnosis) en paralelo
Dia 5: Fase 8 (test E2E con 5 empresas)
```

**Siguiente paso:** Usar `@coder` para implementar Fase 1 (tipos TypeScript).

# SPEC FASE 4: Identificacion de Tipo de Constructora

## Resumen Ejecutivo

La Fase 4 implementa la clasificacion automatica de constructoras en dos categorias principales:
- **Modular**: Empresas con catalogo fijo de modelos predefinidos
- **Tradicional**: Empresas que trabajan con proyectos personalizados/a medida
- **Mixta**: Empresas que ofrecen ambas modalidades

Esta clasificacion permite ajustar el comportamiento del chatbot para dar respuestas mas relevantes segun el tipo de empresa.

---

## Objetivo

Detectar automaticamente si una constructora es modular (catalogo fijo) o tradicional (proyectos a medida), y ajustar el system prompt del chatbot en consecuencia.

### Problemas que Resuelve

1. **Respuestas irrelevantes**: Preguntar por "modelos" a una empresa que no tiene catalogo fijo
2. **Flujo de calificacion inadecuado**: Diferentes preguntas segun el tipo de empresa
3. **Confusion del usuario**: Expectativas erroneas sobre lo que ofrece la empresa

### Metricas de Exito

| Metrica | Actual | Objetivo |
|---------|--------|----------|
| Clasificacion correcta | N/A | >85% |
| Respuestas contextualizadas | ~50% | >90% |
| Flujo de calificacion adecuado | ~60% | >90% |

---

## Arquitectura de Cambios

```
src/
  lib/
    firecrawl.ts           # MODIFICAR - agregar classifyConstructora()
    prompt-generator.ts    # MODIFICAR - ajustar prompt segun tipo
  types/
    index.ts               # YA TIENE constructoraType (no necesita cambios)
```

### Dependencias Entre Archivos

```
firecrawl.ts
    |
    v (retorna constructoraType en ScrapedContent)
prompt-generator.ts
    |
    v (usa constructoraType para generar prompt contextualizado)
```

---

## Analisis del Codebase Actual

### Estado Actual de `src/types/index.ts`

El tipo `constructoraType` YA EXISTE en la interface `ScrapedContent`:

```typescript
export interface ScrapedContent {
  title: string;
  description: string;
  services: string[];
  models: string[];
  contactInfo: string;
  rawText: string;
  faqs?: { question: string; answer: string }[];
  socialLinks?: SocialLinks;
  constructoraType?: 'modular' | 'tradicional' | 'mixta';  // <-- YA EXISTE
}
```

### Estado Actual de `src/lib/firecrawl.ts`

- **Linea 571-1072**: Funcion principal `scrapeWithFirecrawl()`
- **Linea 1062-1071**: Retorno final donde debemos agregar `constructoraType`
- **NO existe** la funcion `classifyConstructora()` - debe crearse

### Estado Actual de `src/lib/prompt-generator.ts`

- **Linea 23-26**: Ya detecta patrones de "diseno personalizado" con regex basico
- **Linea 54-61**: Seccion de modelos para empresas de diseno personalizado
- **LIMITACION**: La deteccion actual es muy basica y no considera todas las senales

---

## FASE 4.1: Crear Funcion classifyConstructora()

### Ubicacion: `src/lib/firecrawl.ts`

Agregar la funcion ANTES de la funcion `scrapeWithFirecrawl()` (alrededor de linea 568).

### Interface de Retorno

```typescript
// ===========================================================
// AGREGAR ANTES DE scrapeWithFirecrawl() (~linea 568)
// ===========================================================

interface ConstructoraClassification {
  type: 'modular' | 'tradicional' | 'mixta';
  confidence: number;  // 0.0 - 1.0
  signals: string[];   // Razones de la clasificacion
  debug: {
    modularScore: number;
    tradicionalScore: number;
    modelsCount: number;
  };
}
```

### Codigo Completo de classifyConstructora()

```typescript
/**
 * Clasifica el tipo de constructora basado en el contenido scrapeado
 *
 * MODULAR: Empresas con catalogo fijo (3+ modelos, keywords "catalogo", "modular", etc.)
 * TRADICIONAL: Empresas de proyectos a medida (0 modelos, keywords "a medida", "personalizado")
 * MIXTA: Empresas que ofrecen ambas modalidades
 */
function classifyConstructora(
  markdown: string,
  modelsCount: number,
  models: string[]
): ConstructoraClassification {
  const signals: string[] = [];
  let modularScore = 0;
  let tradicionalScore = 0;

  const textLower = markdown.toLowerCase();

  // ===================
  // SENALES DE MODULAR
  // ===================

  // 1. Cantidad de modelos (senal mas fuerte)
  if (modelsCount >= 5) {
    modularScore += 4;
    signals.push(`${modelsCount} modelos detectados (muy probable modular)`);
  } else if (modelsCount >= 3) {
    modularScore += 3;
    signals.push(`${modelsCount} modelos detectados (probable modular)`);
  } else if (modelsCount >= 1) {
    modularScore += 1;
    signals.push(`${modelsCount} modelo(s) detectado(s)`);
  }

  // 2. Keywords de catalogo/modular
  const modularKeywords = [
    { pattern: /cat[aá]logo/gi, weight: 2, name: 'catalogo' },
    { pattern: /modular(es)?/gi, weight: 2, name: 'modular' },
    { pattern: /prefabricad[oa]s?/gi, weight: 2, name: 'prefabricado' },
    { pattern: /steel\s*frame/gi, weight: 2, name: 'steel frame' },
    { pattern: /industrializad[oa]s?/gi, weight: 1, name: 'industrializado' },
    { pattern: /linea\s+de\s+(casas|productos|modelos)/gi, weight: 2, name: 'linea de modelos' },
    { pattern: /nuestros\s+modelos/gi, weight: 2, name: 'nuestros modelos' },
    { pattern: /modelos\s+disponibles/gi, weight: 2, name: 'modelos disponibles' },
    { pattern: /ver\s+(todos\s+los\s+)?modelos/gi, weight: 1, name: 'ver modelos' },
  ];

  for (const kw of modularKeywords) {
    const matches = textLower.match(kw.pattern);
    if (matches && matches.length > 0) {
      modularScore += kw.weight;
      signals.push(`Keyword modular: "${kw.name}" (${matches.length}x)`);
    }
  }

  // 3. Nombres de modelos con patrones tipicos de catalogo
  const catalogModelPatterns = /modelo\s+[A-Z]?\d+|casa\s+(sara|flex|pro|plus|eco|mini|max)/gi;
  const catalogModelMatches = models.join(' ').match(catalogModelPatterns);
  if (catalogModelMatches && catalogModelMatches.length > 0) {
    modularScore += 2;
    signals.push(`Nombres de modelos tipo catalogo: ${catalogModelMatches.slice(0, 3).join(', ')}`);
  }

  // 4. Precios listados para multiples modelos
  const pricePatterns = /(?:USD|U\$D|\$)\s*[\d.,]+\s*(?:\.?\d{3})*(?:\s*(?:desde|llave\s*en\s*mano))?/gi;
  const priceMatches = textLower.match(pricePatterns);
  if (priceMatches && priceMatches.length >= 3) {
    modularScore += 2;
    signals.push(`${priceMatches.length} precios listados (tipico de catalogo)`);
  }

  // ======================
  // SENALES DE TRADICIONAL
  // ======================

  // 1. Keywords de diseno a medida
  const tradicionalKeywords = [
    { pattern: /a\s*medida/gi, weight: 3, name: 'a medida' },
    { pattern: /dise[ñn]o\s*personalizado/gi, weight: 3, name: 'diseno personalizado' },
    { pattern: /proyecto\s*personalizado/gi, weight: 3, name: 'proyecto personalizado' },
    { pattern: /custom/gi, weight: 2, name: 'custom' },
    { pattern: /dise[ñn]amos\s*(tu|su)\s*(casa|proyecto)/gi, weight: 3, name: 'disenamos tu casa' },
    { pattern: /seg[uú]n\s*(tus|sus)\s*necesidades/gi, weight: 2, name: 'segun tus necesidades' },
    { pattern: /proyectos?\s*(a\s*medida|personalizado)/gi, weight: 3, name: 'proyectos a medida' },
    { pattern: /construimos\s*(lo\s*que\s*(so[ñn][aá]s|quer[eé]s)|tu\s*proyecto)/gi, weight: 2, name: 'construimos tu proyecto' },
    { pattern: /arquitectura\s*a\s*medida/gi, weight: 3, name: 'arquitectura a medida' },
    { pattern: /sin\s*modelos?\s*fijos?/gi, weight: 3, name: 'sin modelos fijos' },
  ];

  for (const kw of tradicionalKeywords) {
    const matches = textLower.match(kw.pattern);
    if (matches && matches.length > 0) {
      tradicionalScore += kw.weight;
      signals.push(`Keyword tradicional: "${kw.name}" (${matches.length}x)`);
    }
  }

  // 2. Ausencia de modelos es senal fuerte de tradicional
  if (modelsCount === 0) {
    tradicionalScore += 3;
    signals.push('Sin modelos detectados (probable tradicional)');
  }

  // 3. Mencion de arquitectos o estudios de arquitectura
  const architectPatterns = /(?:estudio\s*de\s*)?arquitect[oa]s?|dise[ñn]ador(?:es)?/gi;
  const architectMatches = textLower.match(architectPatterns);
  if (architectMatches && architectMatches.length >= 2) {
    tradicionalScore += 1;
    signals.push(`Mencion de arquitectos/disenadores (${architectMatches.length}x)`);
  }

  // 4. Proceso de diseno personalizado
  const designProcessPatterns = /(?:primera\s*)?reuni[oó]n.*dise[ñn]o|anteproyecto|boceto|planos?\s*personalizados?/gi;
  if (designProcessPatterns.test(textLower)) {
    tradicionalScore += 2;
    signals.push('Mencion de proceso de diseno personalizado');
  }

  // ==================
  // SENALES MIXTAS
  // ==================

  // Detectar si ofrecen ambas modalidades
  const mixedSignals = /(?:modelos?\s*(?:y|o)\s*(?:a\s*medida|personalizado))|(?:(?:a\s*medida|personalizado)\s*(?:y|o)\s*modelos?)|(?:adaptamos?\s*(?:nuestros\s*)?modelos?)/gi;
  if (mixedSignals.test(textLower)) {
    signals.push('Detectada oferta mixta (modelos + personalizados)');
    // No sumamos puntaje, pero lo consideramos en la decision final
  }

  // ====================
  // CALCULAR RESULTADO
  // ====================

  let type: 'modular' | 'tradicional' | 'mixta';
  let confidence: number;

  const totalScore = modularScore + tradicionalScore;

  if (totalScore === 0) {
    // Sin senales claras - usar heuristica basada en modelos
    if (modelsCount >= 2) {
      type = 'modular';
      confidence = 0.4;
      signals.push('Clasificado por defecto como modular (tiene modelos)');
    } else {
      type = 'tradicional';
      confidence = 0.3;
      signals.push('Clasificado por defecto como tradicional (sin info clara)');
    }
  } else {
    const modularRatio = modularScore / totalScore;
    const tradicionalRatio = tradicionalScore / totalScore;

    if (modularRatio > 0.65) {
      type = 'modular';
      confidence = Math.min(0.95, 0.5 + (modularScore / 20));
    } else if (tradicionalRatio > 0.65) {
      type = 'tradicional';
      confidence = Math.min(0.95, 0.5 + (tradicionalScore / 20));
    } else {
      // Puntajes similares = probablemente mixta
      type = 'mixta';
      confidence = Math.min(0.8, 0.4 + (totalScore / 30));
      signals.push('Senales equilibradas: modular vs tradicional');
    }
  }

  return {
    type,
    confidence,
    signals,
    debug: {
      modularScore,
      tradicionalScore,
      modelsCount
    }
  };
}
```

---

## FASE 4.2: Integrar en scrapeWithFirecrawl()

### Ubicacion: `src/lib/firecrawl.ts`

Modificar el retorno de `scrapeWithFirecrawl()` (lineas 1056-1071).

### Codigo Actual (lineas 1056-1071)

```typescript
  // Extraer redes sociales del markdown combinado
  const socialLinks = extractSocialLinks(combinedMarkdown);
  console.log('[Firecrawl] Social links found:', socialLinks);

  // Convertir al formato ScrapedContent
  return {
    title: companyName || SCRAPING_FAILED_MARKER,
    description: buildDescription(companyDescription, constructionMethod, hasFinancing),
    services: buildServices(constructionMethod, hasFinancing, locations),
    models: allModels.map(formatModelString),
    contactInfo: formatContactInfo(contactInfo),
    rawText: combinedMarkdown.slice(0, 20000),
    faqs: faqs.length > 0 ? faqs : undefined,
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
  };
```

### Codigo Modificado

```typescript
  // Extraer redes sociales del markdown combinado
  const socialLinks = extractSocialLinks(combinedMarkdown);
  console.log('[Firecrawl] Social links found:', socialLinks);

  // ===========================================================
  // NUEVO: Clasificar tipo de constructora
  // ===========================================================
  const classification = classifyConstructora(
    combinedMarkdown,
    allModels.length,
    allModels.map(m => m.name)
  );
  console.log('[Firecrawl] Constructora classification:', {
    type: classification.type,
    confidence: classification.confidence.toFixed(2),
    signals: classification.signals.slice(0, 5)  // Solo primeras 5 senales para el log
  });

  // Convertir al formato ScrapedContent
  return {
    title: companyName || SCRAPING_FAILED_MARKER,
    description: buildDescription(companyDescription, constructionMethod, hasFinancing),
    services: buildServices(constructionMethod, hasFinancing, locations),
    models: allModels.map(formatModelString),
    contactInfo: formatContactInfo(contactInfo),
    rawText: combinedMarkdown.slice(0, 20000),
    faqs: faqs.length > 0 ? faqs : undefined,
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
    constructoraType: classification.type,  // NUEVO
  };
```

---

## FASE 4.3: Ajustar Prompt Generator

### Ubicacion: `src/lib/prompt-generator.ts`

Modificar la funcion `generateSystemPromptWithCatalog()` para usar `constructoraType`.

### Codigo Actual (lineas 21-73)

```typescript
  // Build models section - combining web scraped + PDF catalog
  let modelsSection = '';

  // Detectar si es empresa de diseno personalizado (sin catalogo fijo)
  const customDesignPatterns = /diseno\s*(personalizado|a\s*medida|custom)|a\s*medida|proyecto\s*personalizado|disenamos\s*a\s*medida/i;
  const isCustomDesignCompany = rawText ? customDesignPatterns.test(rawText) : false;

  // Models from PDF catalog (priority)
  if (catalog && catalog.models.length > 0) {
    modelsSection = `...`;
  } else if (models.length > 0) {
    modelsSection = `...`;
  } else if (isCustomDesignCompany) {
    modelsSection = `...`;
  } else {
    modelsSection = `...`;
  }
```

### Codigo Modificado

```typescript
  // ===========================================================
  // MODIFICADO: Usar constructoraType en lugar de regex basico
  // ===========================================================

  // Build models section - combining web scraped + PDF catalog
  let modelsSection = '';

  // Obtener tipo de constructora del ScrapedContent (ya clasificado por firecrawl.ts)
  const constructoraType = scrapedContent.constructoraType || 'modular';  // Default modular para backwards compatibility

  // Models from PDF catalog (priority) - SIEMPRE tiene prioridad si existe
  if (catalog && catalog.models.length > 0) {
    modelsSection = `
## CATALOGO DE MODELOS (INFORMACION OFICIAL - USAR SIEMPRE)

${catalog.models.map((m, i) => {
  const details: string[] = [];
  details.push(`### ${i + 1}. ${m.name}`);
  if (m.description) details.push(`- **Descripcion**: ${m.description}`);
  if (m.sqMeters) details.push(`- **Superficie**: ${m.sqMeters}`);
  if (m.bedrooms) details.push(`- **Dormitorios**: ${m.bedrooms}`);
  if (m.bathrooms) details.push(`- **Banos**: ${m.bathrooms}`);
  if (m.price) details.push(`- **Precio**: ${m.price}`);
  if (m.features && m.features.length > 0) {
    details.push(`- **Incluye**: ${m.features.join(', ')}`);
  }
  return details.join('\n');
}).join('\n\n')}

**IMPORTANTE**: Cuando te pregunten por modelos, SIEMPRE menciona estos nombres especificos con sus caracteristicas.
`;
  } else if (constructoraType === 'tradicional') {
    // ===========================================================
    // NUEVO: Seccion especifica para constructoras tradicionales
    // ===========================================================
    modelsSection = `
## SOBRE NUESTROS PROYECTOS

Esta empresa trabaja con **proyectos personalizados** - no tiene modelos fijos predefinidos.

### Como Responder sobre Modelos/Casas:
- NO menciones "modelos" ni "catalogo" - esta empresa no los tiene
- Explica que disenamos y construimos a medida segun las necesidades del cliente
- Enfoca la conversacion en entender que necesita el cliente

### Preguntas Clave para Calificar:
1. Cuantos metros cuadrados (m2) necesitas?
2. Cuantos dormitorios y banos?
3. Ya tenes terreno? En que zona?
4. Tenes alguna referencia de lo que te gustaria? (fotos, planos, ideas)
5. Cual es tu presupuesto aproximado?

### Ejemplo de Respuesta:
Usuario: "Que modelos tienen?"
Sofia: "Trabajamos con proyectos personalizados, no tenemos modelos fijos. Disenamos tu casa a medida segun lo que necesites. Contame, cuantos metros cuadrados estas pensando? Y cuantos dormitorios necesitas?"
`;
  } else if (constructoraType === 'mixta') {
    // ===========================================================
    // NUEVO: Seccion para constructoras mixtas
    // ===========================================================
    if (models.length > 0) {
      modelsSection = `
## MODELOS DISPONIBLES Y PROYECTOS A MEDIDA

Esta empresa ofrece **dos modalidades**:
1. Modelos de catalogo (con caracteristicas predefinidas)
2. Proyectos personalizados (disenamos segun tus necesidades)

### Modelos de Catalogo:
${models.map(m => `- ${m}`).join('\n')}

### Proyectos Personalizados:
Tambien disenamos a medida si ninguno de estos modelos se ajusta a lo que buscas.

### Como Responder:
- Primero muestra los modelos disponibles
- Si ninguno encaja, ofrece la opcion de diseno personalizado
- Pregunta que prefiere el cliente: modelo existente o a medida
`;
    } else {
      modelsSection = `
## SOBRE NUESTROS SERVICIOS

Esta empresa ofrece tanto modelos predefinidos como proyectos a medida.
No tengo el catalogo de modelos cargado actualmente.

### Como Responder:
- Menciona que hay modelos disponibles pero no tenes el detalle
- Ofrece la opcion de diseno personalizado
- Sugiere contactar por WhatsApp para ver el catalogo completo
`;
    }
  } else if (models.length > 0) {
    // Constructora MODULAR con modelos scrapeados
    modelsSection = `
## MODELOS DISPONIBLES
${models.map(m => `- ${m}`).join('\n')}
`;
  } else {
    // Sin modelos estructurados - BUSCAR EN RAWTEXT PRIMERO
    modelsSection = `
## MODELOS DISPONIBLES
No se encontraron modelos estructurados automaticamente.

**IMPORTANTE**: La informacion de modelos PUEDE estar en las secciones de "INFORMACION ADICIONAL DE LA EMPRESA" o "CONTENIDO COMPLETO DEL CATALOGO".
ANTES de decir que no tenes informacion, BUSCA en esas secciones por nombres de modelos, superficies (m2), dormitorios, etc.

SOLO si despues de buscar en TODO el contenido no encontras nada, deci: "No tengo el catalogo completo cargado, pero podes contactarnos por WhatsApp para que te pasen toda la info."
`;
  }
```

### Modificacion Adicional: Agregar Instrucciones Contextualizadas

Agregar despues de la seccion de modelos (alrededor de linea 95):

```typescript
  // ===========================================================
  // NUEVO: Instrucciones de calificacion segun tipo de constructora
  // ===========================================================
  let qualificationInstructions = '';

  if (constructoraType === 'tradicional') {
    qualificationInstructions = `
## FLUJO DE CALIFICACION (EMPRESA TRADICIONAL)

Como esta empresa trabaja con proyectos a medida, tu objetivo principal es entender las necesidades del cliente.

### Orden de Preguntas (UNA A LA VEZ):
1. "Cuantos metros cuadrados estas pensando para tu casa?"
2. "Cuantos dormitorios y banos necesitas?"
3. "Ya tenes el terreno? En que zona?"
4. "Tenes alguna referencia visual de lo que te gustaria? (fotos, planos)"
5. "Cual es tu presupuesto aproximado?"

### NO Hagas:
- No menciones "modelos" ni "catalogo"
- No inventes opciones predefinidas
- No preguntes todas las cosas juntas

### SI Haces:
- Escucha activamente lo que necesita
- Valida sus ideas ("Suena muy lindo lo que tenes en mente")
- Ofrece agendar una reunion para hablar del diseno
`;
  } else if (constructoraType === 'modular') {
    qualificationInstructions = `
## FLUJO DE CALIFICACION (EMPRESA MODULAR)

Como esta empresa tiene modelos predefinidos, tu objetivo es mostrar las opciones y encontrar la mejor para el cliente.

### Orden de Preguntas (UNA A LA VEZ):
1. "Que tamano de casa estas buscando? (cantidad de dormitorios o m2)"
2. "Ya viste algun modelo que te haya gustado?"
3. "Ya tenes el terreno? En que zona?"
4. "Para cuando lo necesitarias?"
5. "Que presupuesto manejas aproximadamente?"

### Estrategia:
- Muestra modelos que encajen con lo que pide
- Compara opciones similares
- Destaca caracteristicas diferenciales
`;
  } else {
    // Mixta o default
    qualificationInstructions = `
## FLUJO DE CALIFICACION

### Orden de Preguntas (UNA A LA VEZ):
1. "Que tamano de casa estas buscando?"
2. "Ya tenes terreno? En que zona?"
3. "Preferis elegir de un catalogo de modelos o diseno a medida?"
4. "Para cuando lo necesitarias?"
5. "Que presupuesto manejas aproximadamente?"
`;
  }
```

### Modificacion Final: Incluir qualificationInstructions en el Prompt

Modificar el return final del prompt (linea ~147):

```typescript
  return `Sos Sofia, asesora comercial de ${title}. Sos una vendedora experta que conoce TODOS los detalles de los productos de la empresa.

## TU PERSONALIDAD
- Sos argentina, usas "vos" NUNCA "tu"
- Calida, amigable pero profesional
- Respondes de forma concisa (2-4 oraciones) pero SIEMPRE con informacion especifica
- Empatica con las necesidades del cliente
- Entusiasta sobre los productos de la empresa

## INFORMACION DE LA EMPRESA
**Empresa**: ${title}
**Descripcion**: ${description}
**Tipo de Constructora**: ${constructoraType.toUpperCase()}
${servicesSection}
${modelsSection}
${pricesSection}
${featuresSection}
${specificationsSection}
${contactSection}
${qualificationInstructions}
${additionalInfo}
${catalogRawSection}

// ... resto del prompt igual ...
`;
```

---

## FASE 4.4: Tests de Verificacion

### Crear archivo de test: `src/scripts/test-classification.ts`

```typescript
/**
 * Script para testear la clasificacion de constructoras
 * Ejecutar: npx ts-node src/scripts/test-classification.ts
 */

interface TestCase {
  name: string;
  url: string;
  expectedType: 'modular' | 'tradicional' | 'mixta';
  notes: string;
}

const TEST_CASES: TestCase[] = [
  // Modulares claras
  {
    name: 'ViBert',
    url: 'https://vibert.com.ar',
    expectedType: 'modular',
    notes: 'Tiene catalogo de casas y quinchos con nombres especificos'
  },
  {
    name: 'Wellmod',
    url: 'https://wellmod.com.ar',
    expectedType: 'modular',
    notes: 'Modelos W26, W42, etc. claramente definidos'
  },
  {
    name: 'Atlas Housing',
    url: 'https://atlashousing.com.ar',
    expectedType: 'modular',
    notes: 'Catalogo de casas modulares'
  },

  // Tradicionales claras
  {
    name: 'Ejemplo Arquitectos',  // Reemplazar con empresa real
    url: 'https://ejemplo-arquitectos.com.ar',
    expectedType: 'tradicional',
    notes: 'Estudio de arquitectura, proyectos a medida'
  },

  // Mixtas
  {
    name: 'Ejemplo Mixta',  // Reemplazar con empresa real
    url: 'https://ejemplo-mixta.com.ar',
    expectedType: 'mixta',
    notes: 'Ofrece modelos y tambien personalizados'
  }
];

async function runTests() {
  console.log('=== TEST DE CLASIFICACION DE CONSTRUCTORAS ===\n');

  const results: { passed: number; failed: number; details: string[] } = {
    passed: 0,
    failed: 0,
    details: []
  };

  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.name} (${testCase.url})`);
    console.log(`Expected: ${testCase.expectedType}`);

    try {
      // Llamar al endpoint de creacion
      const response = await fetch('http://localhost:3000/api/simulator/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: testCase.url })
      });

      const data = await response.json();

      // Obtener el tipo del system prompt (buscar el patron)
      const typeMatch = data.systemPrompt?.match(/Tipo de Constructora:\s*(MODULAR|TRADICIONAL|MIXTA)/i);
      const actualType = typeMatch ? typeMatch[1].toLowerCase() : 'unknown';

      const passed = actualType === testCase.expectedType;

      if (passed) {
        results.passed++;
        console.log(`PASSED: Got ${actualType}`);
      } else {
        results.failed++;
        console.log(`FAILED: Got ${actualType}, expected ${testCase.expectedType}`);
        results.details.push(`${testCase.name}: got ${actualType}, expected ${testCase.expectedType}`);
      }
    } catch (error) {
      results.failed++;
      console.log(`ERROR: ${error}`);
      results.details.push(`${testCase.name}: error - ${error}`);
    }

    console.log('---\n');
  }

  console.log('=== RESUMEN ===');
  console.log(`Passed: ${results.passed}/${TEST_CASES.length}`);
  console.log(`Failed: ${results.failed}/${TEST_CASES.length}`);

  if (results.details.length > 0) {
    console.log('\nFallas:');
    results.details.forEach(d => console.log(`  - ${d}`));
  }
}

runTests().catch(console.error);
```

---

## Resumen de Cambios

### Archivos a Modificar

| Archivo | Lineas | Tipo de Cambio |
|---------|--------|----------------|
| `src/lib/firecrawl.ts` | ~568 | AGREGAR funcion `classifyConstructora()` |
| `src/lib/firecrawl.ts` | 1056-1071 | MODIFICAR retorno para incluir clasificacion |
| `src/lib/prompt-generator.ts` | 21-73 | MODIFICAR logica de `modelsSection` |
| `src/lib/prompt-generator.ts` | ~95 | AGREGAR `qualificationInstructions` |
| `src/lib/prompt-generator.ts` | ~147 | MODIFICAR prompt final |

### Archivos a Crear

| Archivo | Proposito |
|---------|-----------|
| `src/scripts/test-classification.ts` | Tests de verificacion |

### No Requiere Cambios

| Archivo | Razon |
|---------|-------|
| `src/types/index.ts` | Ya tiene `constructoraType` definido |

---

## Verificacion Final

### Comandos de Test

```bash
# 1. Ejecutar el servidor de desarrollo
npm run dev

# 2. En otra terminal, ejecutar tests de clasificacion
npx ts-node src/scripts/test-classification.ts

# 3. Test manual con empresa especifica
curl -X POST http://localhost:3000/api/simulator/create \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl": "https://vibert.com.ar"}' | jq '.systemPrompt' | head -100
```

### Criterios de Aceptacion

1. [ ] `classifyConstructora()` retorna tipo correcto para empresas de prueba
2. [ ] Confidence score > 0.6 para clasificaciones claras
3. [ ] System prompt incluye "Tipo de Constructora: X" visible
4. [ ] Empresas tradicionales NO mencionan "modelos disponibles"
5. [ ] Empresas modulares muestran lista de modelos
6. [ ] Flujo de calificacion es diferente segun tipo

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Clasificacion incorrecta | Media | Medio | Override manual en ScrapedContent, fallback a "mixta" |
| Keywords insuficientes | Media | Bajo | Agregar mas keywords con el tiempo segun feedback |
| Empresas ambiguas | Alta | Bajo | Clasificar como "mixta" si confidence < 0.5 |

---

## Siguiente Paso

Una vez implementada la FASE 4, continuar con:
- **FASE 5**: Sistema de Logging y Analisis mejorado
- **FASE 6**: QA Final con las 20 empresas para medir mejoras

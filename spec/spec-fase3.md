# Spec Fase 3: Sistema Anti-Alucinacion

## Resumen Ejecutivo

La Fase 3 implementa un sistema de busqueda inteligente y validacion de respuestas para reducir las "alucinaciones" del LLM (datos inventados) y las respuestas innecesarias de "no tengo informacion".

**Problema actual:**
- El LLM a veces inventa precios, modelos o caracteristicas
- Responde "no tengo esa informacion" sin buscar bien en el rawText/catalogRaw
- No hay validacion post-respuesta para detectar datos inventados

**Solucion:**
1. `ContentSearcher`: Busqueda por keywords mejorada con fuzzy matching
2. Integracion en prompt-generator con instrucciones RAG-like
3. `ResponseValidator`: Validacion post-respuesta para detectar alucinaciones

---

## Archivos a Crear/Modificar

| Archivo | Accion | Complejidad |
|---------|--------|-------------|
| `src/lib/content-search.ts` | CREAR | Media |
| `src/lib/response-validator.ts` | CREAR | Media |
| `src/lib/prompt-generator.ts` | MODIFICAR | Baja |
| `src/app/api/chat/route.ts` | MODIFICAR | Baja |
| `src/types/index.ts` | MODIFICAR | Baja |

---

## Fase 3.1: Content Searcher

### Archivo: `src/lib/content-search.ts`

```typescript
/**
 * Content Searcher - Busqueda inteligente en el contenido scrapeado
 * Sin dependencias externas - usa fuzzy matching basico
 */

import { ScrapedContent } from '@/types';
import { ExtractedCatalog } from './pdf-extractor';

export interface SearchResult {
  content: string;
  source: 'models' | 'faq' | 'rawText' | 'catalog' | 'prices' | 'specifications';
  relevance: number;
  matchedKeywords: string[];
}

export interface SearchContext {
  scrapedContent: ScrapedContent;
  catalog?: ExtractedCatalog;
}

// Stopwords en espanol para ignorar en la busqueda
const STOPWORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
  'que', 'es', 'son', 'y', 'o', 'pero', 'si', 'no',
  'me', 'te', 'se', 'nos', 'le', 'les', 'lo', 'esto',
  'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'cual', 'cuales', 'como', 'donde', 'cuando', 'quien',
  'hay', 'tiene', 'tienen', 'tengo', 'tenes', 'tenemos',
  'quiero', 'queres', 'queremos', 'puedo', 'podes', 'puede',
  'mas', 'muy', 'mucho', 'poco', 'todo', 'todos', 'nada',
]);

// Sinonimos comunes en el rubro de constructoras
const SYNONYMS: Record<string, string[]> = {
  'precio': ['costo', 'valor', 'cuanto', 'sale', 'cotizacion', 'presupuesto', 'usd', 'dolares', 'pesos', '$'],
  'modelo': ['casa', 'vivienda', 'proyecto', 'tipologia', 'version'],
  'dormitorio': ['habitacion', 'cuarto', 'dorm', 'ambiente', 'pieza'],
  'bano': ['toilette', 'sanitario', 'banio'],
  'metro': ['m2', 'm²', 'metros', 'superficie', 'cubierto', 'semicubierto'],
  'financiacion': ['cuotas', 'pago', 'credito', 'financiar', 'plan'],
  'entrega': ['plazo', 'tiempo', 'demora', 'construccion', 'obra'],
  'cobertura': ['zona', 'llegan', 'envio', 'instalacion', 'pais', 'provincia'],
  'material': ['steel', 'frame', 'hormigon', 'madera', 'prefabricado', 'modular'],
  'incluye': ['viene', 'trae', 'tiene', 'cuenta', 'equipado'],
  'dvh': ['vidrio', 'ventana', 'abertura', 'doble'],
  'garantia': ['respaldo', 'asegura', 'cubre'],
};

export class ContentSearcher {
  private rawText: string;
  private models: string[];
  private faqs: Array<{ question: string; answer: string }>;
  private catalog?: ExtractedCatalog;
  private indexedChunks: Array<{ text: string; source: SearchResult['source'] }>;

  constructor(context: SearchContext) {
    this.rawText = context.scrapedContent.rawText || '';
    this.models = context.scrapedContent.models || [];
    this.faqs = context.scrapedContent.faqs || [];
    this.catalog = context.catalog;
    this.indexedChunks = this.buildIndex();
  }

  /**
   * Construye un indice de chunks para busqueda rapida
   */
  private buildIndex(): Array<{ text: string; source: SearchResult['source'] }> {
    const chunks: Array<{ text: string; source: SearchResult['source'] }> = [];

    // Indexar modelos (alta prioridad)
    for (const model of this.models) {
      chunks.push({ text: model, source: 'models' });
    }

    // Indexar modelos del catalogo PDF si existen
    if (this.catalog?.models) {
      for (const model of this.catalog.models) {
        const modelText = [
          model.name,
          model.description,
          model.sqMeters ? `${model.sqMeters} m2` : '',
          model.bedrooms ? `${model.bedrooms} dormitorios` : '',
          model.bathrooms ? `${model.bathrooms} banos` : '',
          model.price || '',
          model.features?.join(', ') || '',
        ].filter(Boolean).join(' - ');
        chunks.push({ text: modelText, source: 'catalog' });
      }
    }

    // Indexar precios del catalogo
    if (this.catalog?.prices) {
      for (const price of this.catalog.prices) {
        chunks.push({ text: price, source: 'prices' });
      }
    }

    // Indexar especificaciones del catalogo
    if (this.catalog?.specifications) {
      for (const spec of this.catalog.specifications) {
        chunks.push({ text: spec, source: 'specifications' });
      }
    }

    // Indexar FAQs
    for (const faq of this.faqs) {
      chunks.push({
        text: `Pregunta: ${faq.question} Respuesta: ${faq.answer}`,
        source: 'faq'
      });
    }

    // Indexar rawText en chunks de ~500 caracteres
    const textChunks = this.chunkText(this.rawText, 500);
    for (const chunk of textChunks) {
      chunks.push({ text: chunk, source: 'rawText' });
    }

    // Indexar rawText del catalogo
    if (this.catalog?.rawText) {
      const catalogChunks = this.chunkText(this.catalog.rawText, 500);
      for (const chunk of catalogChunks) {
        chunks.push({ text: chunk, source: 'catalog' });
      }
    }

    return chunks;
  }

  /**
   * Divide texto en chunks con overlap para no perder contexto
   */
  private chunkText(text: string, chunkSize: number, overlap: number = 50): string[] {
    const chunks: string[] = [];
    if (!text) return chunks;

    // Limpiar texto
    const cleanText = text.replace(/\s+/g, ' ').trim();

    for (let i = 0; i < cleanText.length; i += chunkSize - overlap) {
      const chunk = cleanText.slice(i, i + chunkSize);
      if (chunk.length > 50) { // Solo chunks con contenido significativo
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Extrae keywords de una query, expandiendo con sinonimos
   */
  extractKeywords(query: string): string[] {
    // Normalizar query
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^\w\s]/g, ' '); // Remover puntuacion

    // Tokenizar
    const tokens = normalized
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS_ES.has(w));

    // Expandir con sinonimos
    const expanded = new Set<string>();
    for (const token of tokens) {
      expanded.add(token);

      // Buscar sinonimos
      for (const [key, synonyms] of Object.entries(SYNONYMS)) {
        if (key === token || synonyms.includes(token)) {
          expanded.add(key);
          synonyms.forEach(s => expanded.add(s));
        }
      }
    }

    return Array.from(expanded);
  }

  /**
   * Calcula relevancia de un texto dado keywords
   * Usa matching exacto + fuzzy (distancia de edicion simple)
   */
  calculateRelevance(text: string, keywords: string[]): { score: number; matched: string[] } {
    if (!text || keywords.length === 0) {
      return { score: 0, matched: [] };
    }

    const textLower = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const matched: string[] = [];
    let totalScore = 0;

    for (const keyword of keywords) {
      // Match exacto (peso: 1.0)
      if (textLower.includes(keyword)) {
        matched.push(keyword);
        totalScore += 1.0;
        continue;
      }

      // Fuzzy match: buscar palabras similares (1-2 ediciones)
      const words = textLower.split(/\s+/);
      for (const word of words) {
        const distance = this.levenshteinDistance(keyword, word);
        if (distance <= 2 && word.length > 3 && keyword.length > 3) {
          matched.push(`~${keyword}`); // Marcar como fuzzy
          totalScore += 0.5; // Peso menor para fuzzy
          break;
        }
      }
    }

    // Normalizar por cantidad de keywords
    const normalizedScore = keywords.length > 0 ? totalScore / keywords.length : 0;

    return { score: normalizedScore, matched };
  }

  /**
   * Distancia de Levenshtein simplificada (ediciones minimas)
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Busca en todo el contenido indexado
   * Retorna los N resultados mas relevantes
   */
  search(query: string, maxResults: number = 5): SearchResult[] {
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      return [];
    }

    console.log(`[ContentSearcher] Query: "${query}"`);
    console.log(`[ContentSearcher] Keywords: ${keywords.join(', ')}`);

    const results: SearchResult[] = [];

    for (const chunk of this.indexedChunks) {
      const { score, matched } = this.calculateRelevance(chunk.text, keywords);

      if (score >= 0.2) { // Umbral minimo de relevancia
        results.push({
          content: chunk.text,
          source: chunk.source,
          relevance: score,
          matchedKeywords: matched,
        });
      }
    }

    // Ordenar por relevancia y luego por prioridad de fuente
    const sourcePriority: Record<SearchResult['source'], number> = {
      'models': 5,
      'catalog': 4,
      'prices': 4,
      'faq': 3,
      'specifications': 3,
      'rawText': 1,
    };

    results.sort((a, b) => {
      // Primero por relevancia
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      // Luego por prioridad de fuente
      return sourcePriority[b.source] - sourcePriority[a.source];
    });

    const topResults = results.slice(0, maxResults);

    console.log(`[ContentSearcher] Found ${results.length} matches, returning top ${topResults.length}`);
    topResults.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.source}] score=${r.relevance.toFixed(2)} matched=${r.matchedKeywords.join(',')}`);
    });

    return topResults;
  }

  /**
   * Verifica si una pieza de informacion existe en el contenido
   * Usado para validar respuestas del LLM
   */
  verifyExists(info: string): { exists: boolean; source?: string; confidence: number } {
    const results = this.search(info, 1);

    if (results.length === 0) {
      return { exists: false, confidence: 0 };
    }

    const topResult = results[0];
    return {
      exists: topResult.relevance >= 0.3,
      source: topResult.source,
      confidence: topResult.relevance,
    };
  }

  /**
   * Busca especificamente informacion sobre un modelo
   */
  searchModel(modelName: string): SearchResult[] {
    // Primero buscar match exacto en models
    const exactMatch = this.models.find(m =>
      m.toLowerCase().includes(modelName.toLowerCase())
    );

    if (exactMatch) {
      return [{
        content: exactMatch,
        source: 'models',
        relevance: 1.0,
        matchedKeywords: [modelName.toLowerCase()],
      }];
    }

    // Si no hay match exacto, hacer busqueda general
    return this.search(modelName);
  }

  /**
   * Busca informacion de precios
   */
  searchPrices(): SearchResult[] {
    const priceKeywords = ['precio', 'usd', 'dolares', 'pesos', '$', 'costo', 'valor'];
    return this.search(priceKeywords.join(' '), 10);
  }
}

/**
 * Factory function para crear searcher desde contexto de sesion
 */
export function createContentSearcher(
  scrapedContent: ScrapedContent,
  catalog?: ExtractedCatalog
): ContentSearcher {
  return new ContentSearcher({ scrapedContent, catalog });
}
```

---

## Fase 3.2: Modificar Prompt Generator

### Archivo: `src/lib/prompt-generator.ts`

**Ubicacion del cambio:** Agregar seccion de instrucciones RAG al final del prompt generado (antes del cierre de la funcion `generateSystemPromptWithCatalog`)

**Linea aproximada:** ~165, despues de `${catalogRawSection}`

```typescript
// AGREGAR ESTA SECCION al prompt (despues de catalogRawSection, antes del return final)

const ragInstructions = `
## SISTEMA DE BUSQUEDA INTELIGENTE (MUY IMPORTANTE)

Cuando un usuario te haga una pregunta, SEGUI ESTOS PASOS EN ORDEN:

### PASO 1: Identificar que busca el usuario
- Pregunta sobre modelos -> buscar en CATALOGO DE MODELOS y MODELOS DISPONIBLES
- Pregunta sobre precios -> buscar en PRECIOS y CONTENIDO DEL CATALOGO
- Pregunta sobre cobertura/envios -> buscar en INFORMACION ADICIONAL y FAQs
- Pregunta tecnica -> buscar en ESPECIFICACIONES y CARACTERISTICAS

### PASO 2: Buscar con keywords relacionados
NO busques solo la palabra exacta. Usa sinonimos:
- "precio" -> tambien buscar: costo, valor, USD, dolares, pesos, $, desde
- "metros" -> tambien buscar: m2, m², superficie, cubierto, semicubierto
- "dormitorio" -> tambien buscar: habitacion, cuarto, ambiente, dorm
- "DVH" -> tambien buscar: vidrio, doble vidriado, ventana, abertura
- "zona/cobertura" -> tambien buscar: llegan, envio, pais, provincia, instalamos

### PASO 3: Buscar en TODAS las secciones
1. PRIMERO: Secciones estructuradas (MODELOS, PRECIOS, FAQ)
2. SEGUNDO: INFORMACION ADICIONAL DE LA EMPRESA
3. TERCERO: CONTENIDO COMPLETO DEL CATALOGO

### PASO 4: Responder segun lo encontrado
- SI ENCONTRAS la info -> responde con los datos exactos
- SI NO ENCONTRAS en NINGUNA seccion -> ofrece contactar por WhatsApp

### EJEMPLOS DE BUSQUEDA CORRECTA

Usuario: "Tienen DVH?"
BUSCAR: "DVH", "doble vidriado", "vidrio", "ventana", "abertura", "doble vidrio"
DONDE: En CARACTERISTICAS, ESPECIFICACIONES y CONTENIDO DEL CATALOGO

Usuario: "Cuanto mide el modelo X?"
BUSCAR: El nombre exacto "X", variaciones como "Casa X", "Modelo X"
DONDE: En MODELOS, CATALOGO y luego INFORMACION ADICIONAL

Usuario: "Llegan a Cordoba?"
BUSCAR: "Cordoba", "todo el pais", "interior", "provincias", "cobertura", "envios"
DONDE: En INFORMACION ADICIONAL, FAQs y CONTENIDO DEL CATALOGO

### REGLA DE ORO
NUNCA digas "no tengo esa informacion" sin ANTES haber buscado en:
1. Todas las secciones estructuradas
2. Todo el contenido raw (INFORMACION ADICIONAL)
3. Todo el catalogo (CONTENIDO DEL CATALOGO)

Si la info NO existe en NINGUNA parte, recien ahi decis:
"No tengo esa informacion especifica cargada, pero podes contactarnos por WhatsApp para que te pasen los detalles."
`;

// MODIFICAR el return para incluir ragInstructions
return `Sos Sofia, asesora comercial de ${title}...
[...resto del prompt existente...]
${additionalInfo}
${catalogRawSection}
${ragInstructions}  // <-- AGREGAR ESTA LINEA
`;
```

### Cambio completo en context

El cambio se hace en la funcion `generateSystemPromptWithCatalog`. Buscar la linea donde se construye el return final (aprox linea 147) y agregar la variable `ragInstructions` antes del template string final.

---

## Fase 3.3: Response Validator

### Archivo: `src/lib/response-validator.ts`

```typescript
/**
 * Response Validator - Detecta posibles alucinaciones en respuestas del LLM
 */

import { ScrapedContent } from '@/types';
import { ExtractedCatalog } from './pdf-extractor';
import { ContentSearcher, createContentSearcher } from './content-search';

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1, que tan seguro estamos de la validacion
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'invented_price' | 'invented_model' | 'invented_spec' | 'invented_location' | 'suspicious_number';
  severity: 'warning' | 'error';
  content: string;
  explanation: string;
}

// Patrones para detectar precios en la respuesta
const PRICE_PATTERNS = [
  /(?:USD|U\$D|U\$S|dolares?)\s*[\d.,]+/gi,
  /\$\s*[\d.,]+(?:\s*(?:USD|dolares?))?/gi,
  /[\d.,]+\s*(?:USD|U\$D|dolares?)/gi,
  /desde\s*(?:USD|U\$D|\$)\s*[\d.,]+/gi,
  /(?:alrededor|aproximadamente|cerca)\s*de\s*(?:USD|U\$D|\$)\s*[\d.,]+/gi,
  /[\d.]+\s*(?:millones?|mil)\s*(?:de\s*)?(?:pesos|dolares)/gi,
];

// Patrones para detectar metros cuadrados
const SQM_PATTERNS = [
  /(\d+(?:[.,]\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/gi,
  /superficie[:\s]+(\d+(?:[.,]\d+)?)/gi,
];

// Patrones para detectar cantidades de ambientes
const ROOMS_PATTERNS = [
  /(\d+)\s*(?:dormitorios?|dorm\.?|habitacion(?:es)?|cuartos?)/gi,
  /(\d+)\s*(?:ba[ñn]os?)/gi,
];

export class ResponseValidator {
  private searcher: ContentSearcher;
  private scrapedContent: ScrapedContent;
  private catalog?: ExtractedCatalog;

  constructor(scrapedContent: ScrapedContent, catalog?: ExtractedCatalog) {
    this.scrapedContent = scrapedContent;
    this.catalog = catalog;
    this.searcher = createContentSearcher(scrapedContent, catalog);
  }

  /**
   * Valida una respuesta del LLM contra el contenido scrapeado
   */
  validate(response: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // 1. Validar precios mencionados
    const priceIssues = this.validatePrices(response);
    issues.push(...priceIssues);

    // 2. Validar modelos mencionados
    const modelIssues = this.validateModels(response);
    issues.push(...modelIssues);

    // 3. Validar especificaciones tecnicas
    const specIssues = this.validateSpecifications(response);
    issues.push(...specIssues);

    // 4. Validar numeros sospechosos (m2, cantidades)
    const numberIssues = this.validateNumbers(response);
    issues.push(...numberIssues);

    // Calcular confianza general
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    // Confianza: 1.0 si no hay issues, baja con cada issue
    const confidence = Math.max(0, 1 - (errorCount * 0.3) - (warningCount * 0.1));

    // Generar sugerencias si hay problemas
    if (errorCount > 0) {
      suggestions.push('La respuesta contiene informacion que no se encontro en el contenido original.');
      suggestions.push('Considera reformular para evitar datos especificos no verificables.');
    }

    if (warningCount > 0 && errorCount === 0) {
      suggestions.push('Algunos datos no pudieron ser verificados con certeza.');
    }

    return {
      isValid: errorCount === 0,
      confidence,
      issues,
      suggestions,
    };
  }

  /**
   * Valida precios mencionados en la respuesta
   */
  private validatePrices(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const pattern of PRICE_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex
      const matches = response.matchAll(pattern);

      for (const match of matches) {
        const priceText = match[0];

        // Verificar si este precio existe en el contenido original
        const verification = this.searcher.verifyExists(priceText);

        if (!verification.exists) {
          // Buscar tambien el numero sin formato
          const numericPart = priceText.replace(/[^\d.,]/g, '');
          const numericVerification = this.searcher.verifyExists(numericPart);

          if (!numericVerification.exists && verification.confidence < 0.3) {
            issues.push({
              type: 'invented_price',
              severity: 'error',
              content: priceText,
              explanation: `Precio "${priceText}" no encontrado en el contenido original. Puede ser inventado.`,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Valida modelos mencionados en la respuesta
   */
  private validateModels(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Extraer posibles nombres de modelos de la respuesta
    // Patrones comunes: "Modelo X", "Casa Y", "el modelo Z"
    const modelPatterns = [
      /(?:modelo|casa|vivienda)\s+["']?([A-Za-z0-9áéíóúñÁÉÍÓÚÑ\s\-]+)["']?/gi,
      /(?:el|la|nuestro|nuestra)\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Z][a-z]+)?)/gi,
    ];

    const mentionedModels = new Set<string>();

    for (const pattern of modelPatterns) {
      pattern.lastIndex = 0;
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const modelName = match[1]?.trim();
        if (modelName && modelName.length > 2 && modelName.length < 30) {
          mentionedModels.add(modelName);
        }
      }
    }

    // Verificar cada modelo mencionado
    for (const modelName of mentionedModels) {
      // Ignorar palabras genericas
      const genericWords = ['casa', 'modelo', 'vivienda', 'proyecto', 'dormitorios', 'banos', 'metros'];
      if (genericWords.some(w => modelName.toLowerCase() === w)) {
        continue;
      }

      const results = this.searcher.searchModel(modelName);

      if (results.length === 0 || results[0].relevance < 0.4) {
        // Verificar si es un nombre conocido en los modelos
        const knownModels = this.scrapedContent.models.join(' ').toLowerCase();
        const catalogModels = this.catalog?.models.map(m => m.name).join(' ').toLowerCase() || '';
        const allModels = `${knownModels} ${catalogModels}`;

        if (!allModels.includes(modelName.toLowerCase())) {
          issues.push({
            type: 'invented_model',
            severity: 'warning', // Warning porque puede ser variacion del nombre
            content: modelName,
            explanation: `Modelo "${modelName}" no encontrado exactamente en el catalogo. Verificar si es correcto.`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Valida especificaciones tecnicas (m2, dormitorios, etc)
   */
  private validateSpecifications(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validar metros cuadrados
    for (const pattern of SQM_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = response.matchAll(pattern);

      for (const match of matches) {
        const sqmValue = match[1];
        const fullMatch = match[0];

        // Verificar si este valor de m2 existe
        const verification = this.searcher.verifyExists(sqmValue);

        if (!verification.exists && verification.confidence < 0.3) {
          // Buscar en contexto mas amplio
          const contextSearch = this.searcher.search(`${sqmValue} m2`);

          if (contextSearch.length === 0 || contextSearch[0].relevance < 0.3) {
            issues.push({
              type: 'invented_spec',
              severity: 'warning',
              content: fullMatch,
              explanation: `Superficie "${fullMatch}" no verificada en el contenido original.`,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Valida numeros que parecen sospechosos
   */
  private validateNumbers(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Detectar numeros muy especificos que podrian ser inventados
    // Ej: "exactamente 87.5 m2" o "USD 47,350"
    const suspiciousPatterns = [
      /exactamente\s+[\d.,]+/gi,
      /precisamente\s+[\d.,]+/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      pattern.lastIndex = 0;
      const matches = response.matchAll(pattern);

      for (const match of matches) {
        const suspiciousText = match[0];

        // Verificar si existe en el contenido
        const verification = this.searcher.verifyExists(suspiciousText);

        if (!verification.exists) {
          issues.push({
            type: 'suspicious_number',
            severity: 'warning',
            content: suspiciousText,
            explanation: `Dato muy especifico "${suspiciousText}" no encontrado. Considerar usar rangos o aproximaciones.`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Metodo rapido para validar si un precio especifico existe
   */
  priceExists(price: string): boolean {
    const verification = this.searcher.verifyExists(price);
    return verification.exists;
  }

  /**
   * Metodo rapido para validar si un modelo existe
   */
  modelExists(modelName: string): boolean {
    const results = this.searcher.searchModel(modelName);
    return results.length > 0 && results[0].relevance >= 0.5;
  }
}

/**
 * Factory function para crear validator
 */
export function createResponseValidator(
  scrapedContent: ScrapedContent,
  catalog?: ExtractedCatalog
): ResponseValidator {
  return new ResponseValidator(scrapedContent, catalog);
}

/**
 * Funcion helper para validacion rapida
 */
export function validateResponse(
  response: string,
  scrapedContent: ScrapedContent,
  catalog?: ExtractedCatalog
): ValidationResult {
  const validator = new ResponseValidator(scrapedContent, catalog);
  return validator.validate(response);
}
```

---

## Fase 3.4: Integrar Validator en Chat Route

### Archivo: `src/app/api/chat/route.ts`

**Cambios a realizar:**

1. Importar el validator
2. Validar respuesta antes de enviarla
3. Loguear warnings/errors de validacion

```typescript
// AGREGAR imports al inicio del archivo
import { validateResponse, ValidationResult } from '@/lib/response-validator';
import { ScrapedContent } from '@/types';
import { ExtractedCatalog } from '@/lib/pdf-extractor';

// MODIFICAR el interface ChatRequestBody para incluir datos de validacion
interface ChatRequestBody {
  sessionId: string;
  message: string;
  systemPrompt: string;
  conversationHistory: ChatMessage[];
  companyName?: string;
  // NUEVOS campos para validacion (opcionales por backwards compatibility)
  scrapedContent?: ScrapedContent;
  catalog?: ExtractedCatalog;
}

// AGREGAR despues de obtener assistantContent (linea ~76)
// Validar respuesta si tenemos el contenido scrapeado
let validationResult: ValidationResult | null = null;

if (scrapedContent) {
  validationResult = validateResponse(assistantContent, scrapedContent, catalog);

  if (!validationResult.isValid) {
    console.warn('[Chat] Respuesta con posibles alucinaciones:', {
      sessionId,
      issues: validationResult.issues,
      confidence: validationResult.confidence,
    });

    // Opcionalmente, podriamos modificar la respuesta o agregar disclaimer
    // Por ahora solo logueamos para analisis
  }
}

// MODIFICAR el log de conversacion para incluir flags de validacion
// En la parte donde se crea allMessages (linea ~81)
const allMessages: Message[] = [
  ...(conversationHistory || []).map((msg, idx) => ({
    id: `hist-${idx}`,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(),
  })),
  {
    id: `user-${Date.now()}`,
    role: 'user' as const,
    content: message,
    timestamp: new Date(),
  },
  {
    id: `assistant-${Date.now()}`,
    role: 'assistant' as const,
    content: assistantContent,
    timestamp: new Date(),
    // NUEVO: flags de validacion
    flags: validationResult ? {
      saidNoInfo: assistantContent.toLowerCase().includes('no tengo') ||
                  assistantContent.toLowerCase().includes('no tengo esa informacion'),
      possibleHallucination: !validationResult.isValid,
      validationConfidence: validationResult.confidence,
    } : undefined,
  },
];
```

---

## Fase 3.5: Actualizar Types

### Archivo: `src/types/index.ts`

```typescript
// AGREGAR al interface Message
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // NUEVO: flags para analisis de calidad
  flags?: {
    saidNoInfo?: boolean;           // Dijo "no tengo esa informacion"
    possibleHallucination?: boolean; // Validador detecto posible alucinacion
    validationConfidence?: number;   // Confianza del validador (0-1)
  };
}
```

---

## Orden de Implementacion

| Paso | Tarea | Dependencias | Complejidad |
|------|-------|--------------|-------------|
| 1 | Crear `src/lib/content-search.ts` | Ninguna | Media |
| 2 | Crear `src/lib/response-validator.ts` | Paso 1 | Media |
| 3 | Modificar `src/types/index.ts` | Ninguna | Baja |
| 4 | Modificar `src/lib/prompt-generator.ts` | Ninguna | Baja |
| 5 | Modificar `src/app/api/chat/route.ts` | Pasos 1-3 | Baja |
| 6 | Testing manual | Todos | Media |

---

## Testing

### Test 1: Content Searcher

```bash
# Crear archivo de test temporal
npx ts-node -e "
import { createContentSearcher } from './src/lib/content-search';

const mockContent = {
  title: 'ViBert Casas',
  description: 'Constructora de casas modulares',
  services: ['Casas prefabricadas'],
  models: ['Casa Sara - 65m2 - 2 dorm - 1 bano - USD 35.000'],
  contactInfo: 'WhatsApp: 5491112345678',
  rawText: 'ViBert fabrica casas steel frame. Llegamos a todo el pais. DVH en todas las aberturas.',
};

const searcher = createContentSearcher(mockContent);

console.log('Test 1: Buscar DVH');
console.log(searcher.search('tienen dvh?'));

console.log('Test 2: Buscar precio');
console.log(searcher.search('cuanto sale'));

console.log('Test 3: Buscar cobertura');
console.log(searcher.search('llegan a cordoba'));

console.log('Test 4: Buscar modelo');
console.log(searcher.searchModel('Sara'));
"
```

### Test 2: Response Validator

```bash
npx ts-node -e "
import { validateResponse } from './src/lib/response-validator';

const mockContent = {
  title: 'ViBert Casas',
  description: 'Constructora',
  services: [],
  models: ['Casa Sara - 65m2 - USD 35.000'],
  contactInfo: '',
  rawText: 'Precio del modelo Sara: USD 35.000',
};

// Test respuesta valida
const validResponse = 'El modelo Sara tiene 65m2 y cuesta USD 35.000';
console.log('Respuesta valida:', validateResponse(validResponse, mockContent));

// Test respuesta con alucinacion
const invalidResponse = 'El modelo Aurora tiene 120m2 y cuesta USD 75.000';
console.log('Respuesta invalida:', validateResponse(invalidResponse, mockContent));
"
```

---

## Metricas de Exito

| Metrica | Antes | Objetivo |
|---------|-------|----------|
| Respuestas "no tengo info" innecesarias | ~30% | <10% |
| Alucinaciones detectadas | 0% (no se detectaban) | >80% detectadas |
| Precios inventados | Desconocido | <5% |
| Modelos inventados | Desconocido | <5% |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Falsos positivos en validacion | Media | Bajo | Ajustar umbrales de confianza |
| Busqueda lenta en textos largos | Baja | Medio | Limitar chunks a ~100 |
| Fuzzy match incorrecto | Baja | Bajo | Usar distancia >= 2 solo para palabras largas |
| LLM ignora instrucciones RAG | Media | Medio | Reforzar con ejemplos en prompt |

---

## Siguiente Fase

Despues de implementar Fase 3, continuar con:
- **Fase 4**: Identificacion de tipo de constructora (modular vs tradicional)
- **Fase 5**: Sistema de logging mejorado con analytics

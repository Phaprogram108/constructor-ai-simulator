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

// Patrones para detectar cantidades de ambientes (no usado directamente pero disponible)
// const ROOMS_PATTERNS = [
//   /(\d+)\s*(?:dormitorios?|dorm\.?|habitacion(?:es)?|cuartos?)/gi,
//   /(\d+)\s*(?:ba[ñn]os?)/gi,
// ];

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
        const knownModels = (this.scrapedContent.models || []).join(' ').toLowerCase();
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

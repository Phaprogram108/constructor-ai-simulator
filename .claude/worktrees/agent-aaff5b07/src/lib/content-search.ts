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

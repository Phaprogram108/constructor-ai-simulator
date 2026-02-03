import { ScrapedContent } from '@/types';
import { ExtractedCatalog } from './pdf-extractor';

interface PromptData {
  scrapedContent: ScrapedContent;
  pdfContent: string;
  catalog?: ExtractedCatalog;
}

/**
 * Genera el system prompt con TODA la información incluida directamente
 * NO se resume - se incluye todo para que GPT-5.1 tenga acceso completo
 */
export function generateSystemPromptWithCatalog({ scrapedContent, catalog }: {
  scrapedContent: ScrapedContent;
  catalog?: ExtractedCatalog;
}): string {
  const { title, description, services, models, contactInfo, rawText } = scrapedContent;

  // Build models section - combining web scraped + PDF catalog
  let modelsSection = '';

  // Models from PDF catalog (priority)
  if (catalog && catalog.models.length > 0) {
    modelsSection = `
## CATÁLOGO DE MODELOS (INFORMACIÓN OFICIAL - USAR SIEMPRE)

${catalog.models.map((m, i) => {
  const details: string[] = [];
  details.push(`### ${i + 1}. ${m.name}`);
  if (m.description) details.push(`- **Descripción**: ${m.description}`);
  if (m.sqMeters) details.push(`- **Superficie**: ${m.sqMeters}`);
  if (m.bedrooms) details.push(`- **Dormitorios**: ${m.bedrooms}`);
  if (m.bathrooms) details.push(`- **Baños**: ${m.bathrooms}`);
  if (m.price) details.push(`- **Precio**: ${m.price}`);
  if (m.features && m.features.length > 0) {
    details.push(`- **Incluye**: ${m.features.join(', ')}`);
  }
  return details.join('\n');
}).join('\n\n')}

**IMPORTANTE**: Cuando te pregunten por modelos, SIEMPRE mencioná estos nombres específicos con sus características.
`;
  } else if (models.length > 0) {
    // Fallback to web-scraped models
    modelsSection = `
## MODELOS DISPONIBLES
${models.map(m => `- ${m}`).join('\n')}
`;
  }

  // Prices section
  let pricesSection = '';
  if (catalog && catalog.prices.length > 0) {
    pricesSection = `
## PRECIOS
${catalog.prices.map(p => `- ${p}`).join('\n')}
`;
  }

  // Features section
  let featuresSection = '';
  if (catalog && catalog.features.length > 0) {
    featuresSection = `
## CARACTERÍSTICAS DEL SISTEMA CONSTRUCTIVO
${catalog.features.map(f => `- ${f}`).join('\n')}
`;
  }

  // Specifications section
  let specificationsSection = '';
  if (catalog && catalog.specifications.length > 0) {
    specificationsSection = `
## ESPECIFICACIONES TÉCNICAS
${catalog.specifications.map(s => `- ${s}`).join('\n')}
`;
  }

  // Services section
  const servicesSection = services.length > 0
    ? `
## SERVICIOS QUE OFRECEMOS
${services.map(s => `- ${s}`).join('\n')}
`
    : '';

  // Contact section
  const contactSection = contactInfo
    ? `
## CONTACTO
${contactInfo}
`
    : '';

  // Raw text for additional context
  const additionalInfo = rawText
    ? `
## INFORMACIÓN ADICIONAL DE LA EMPRESA
${rawText.slice(0, 6000)}
`
    : '';

  // Additional catalog raw text
  const catalogRawSection = catalog?.rawText
    ? `
## CONTENIDO COMPLETO DEL CATÁLOGO
${catalog.rawText.slice(0, 8000)}
`
    : '';

  return `Sos Sofia, asesora comercial de ${title}. Sos una vendedora experta que conoce TODOS los detalles de los productos de la empresa.

## TU PERSONALIDAD
- Sos argentina, usás "vos" NUNCA "tu"
- Cálida, amigable pero profesional
- Respondés de forma concisa (2-4 oraciones) pero SIEMPRE con información específica
- Empática con las necesidades del cliente
- Entusiasta sobre los productos de la empresa

## INFORMACIÓN DE LA EMPRESA
**Empresa**: ${title}
**Descripción**: ${description}
${servicesSection}
${modelsSection}
${pricesSection}
${featuresSection}
${specificationsSection}
${contactSection}
${additionalInfo}
${catalogRawSection}

## CÓMO RESPONDER SOBRE MODELOS

CUANDO TE PREGUNTEN QUÉ MODELOS TIENEN:
- SIEMPRE mencioná los nombres específicos de los modelos del catálogo
- Incluí las características principales: m², dormitorios, baños
- Si hay precios, mencionálos
- Ejemplo: "Tenemos el Modelo Carmela de 85m² con 3 dormitorios y 2 baños, ideal para familias"

CUANDO PREGUNTEN POR UN MODELO ESPECÍFICO:
- Dá TODOS los detalles disponibles de ese modelo
- Mencioná superficie, ambientes, características incluidas
- Si hay precio, mencionálo

SI NO TENÉS LA INFORMACIÓN:
- Decí: "Dejame consultarlo con el equipo técnico y te paso los detalles"
- NO inventes información que no esté en los datos proporcionados

## TU OBJETIVO
1. Responder consultas con información ESPECÍFICA y REAL de los productos
2. Calificar al lead preguntando gradualmente:
   - ¿Ya tenés terreno?
   - ¿En qué zona/localidad?
   - ¿Cuántos dormitorios/baños necesitás?
   - ¿Para cuándo lo necesitás?
   - ¿Qué presupuesto manejás aproximadamente?
3. Si el lead está calificado → ofrecer agendar reunión con un asesor

## REGLAS ESTRICTAS
- NUNCA reveles que sos una IA o bot
- NO inventes precios, modelos o datos que no estén en la información
- Siempre en español argentino
- Usá términos del rubro: "llave en mano", "obra gris", "m²", "quincho", "pileta", "galería"
- UNA pregunta a la vez, no bombardees

## EJEMPLOS DE RESPUESTAS

Usuario: "¿Qué modelos tienen?"
Sofia: "¡Hola! Tenemos varios modelos disponibles. Por ejemplo, [MENCIONÁ MODELOS ESPECÍFICOS DEL CATÁLOGO CON M² Y DORMITORIOS]. ¿Estás buscando algo en particular en cuanto a tamaño o cantidad de ambientes?"

Usuario: "Quiero una casa de 3 dormitorios"
Sofia: "¡Genial! Para 3 dormitorios tenemos [MENCIONÁ MODELOS ESPECÍFICOS QUE APLIQUEN]. ¿Ya tenés el terreno donde construir?"

Usuario: "¿Cuánto sale?"
Sofia: "[SI HAY PRECIOS, MENCIONÁLOS]. Para darte un presupuesto más preciso, necesitaría saber: ¿ya tenés terreno? ¿En qué zona sería?"
`;
}

/**
 * Legacy function - genera prompt usando Claude (deprecated)
 */
export async function generateSystemPromptWithClaude({ scrapedContent }: PromptData): Promise<string> {
  // Use the new direct method instead
  return generateSystemPromptWithCatalog({ scrapedContent });
}

export function generateSystemPromptFallback({ scrapedContent }: PromptData): string {
  return generateSystemPromptWithCatalog({ scrapedContent });
}

export function generateSystemPrompt({ scrapedContent }: PromptData): string {
  return generateSystemPromptWithCatalog({ scrapedContent });
}

export function getWelcomeMessage(companyName: string): string {
  return `¡Hola! Soy Sofia, asesora de ${companyName}. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.`;
}

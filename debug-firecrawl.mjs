import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY
});

console.log("=== DEBUG FIRECRAWL - VIBERT ===\n");

// 1. MAP - Ver qué páginas encuentra
console.log("PASO 1: Mapeando sitio web...");
const mapResult = await firecrawl.mapUrl("https://www.vibert.com.ar/", {
  limit: 20
});
console.log("\nPáginas encontradas:");
console.log(JSON.stringify(mapResult.links?.slice(0, 15), null, 2));

// 2. SCRAPE simple de homepage - Sin AI, solo contenido raw
console.log("\n\nPASO 2: Scrape SIMPLE de homepage (sin AI)...");
const scrapeSimple = await firecrawl.scrapeUrl("https://www.vibert.com.ar/", {
  formats: ['markdown']
});
console.log("\nContenido RAW (primeros 2500 chars):");
console.log(scrapeSimple.markdown?.slice(0, 2500));

// 3. Buscar página de modelos/casas
const modelPages = mapResult.links?.filter(url =>
  url.includes('modelo') || url.includes('casa') || url.includes('proyecto') || url.includes('vivienda')
) || [];
console.log("\n\nPASO 3: Páginas que parecen tener modelos:");
console.log(modelPages.slice(0, 5));

if (modelPages.length > 0) {
  console.log("\nScrapeando primera página de modelos...");
  const modelScrape = await firecrawl.scrapeUrl(modelPages[0], {
    formats: ['markdown']
  });
  console.log("\nContenido de página de modelos (primeros 2000 chars):");
  console.log(modelScrape.markdown?.slice(0, 2000));
}

// 4. SCRAPE con EXTRACT (AI) - Ver si Firecrawl inventa
console.log("\n\nPASO 4: Scrape con EXTRACT (AI de Firecrawl)...");
const scrapeWithAI = await firecrawl.scrapeUrl("https://www.vibert.com.ar/", {
  formats: ['markdown', 'extract'],
  extract: {
    schema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        models: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              squareMeters: { type: "number" },
              price: { type: "string" }
            }
          }
        }
      }
    }
  }
});

console.log("\nDatos extraídos por AI de Firecrawl:");
console.log(JSON.stringify(scrapeWithAI.extract, null, 2));

console.log("\n\n=== FIN DEBUG ===");

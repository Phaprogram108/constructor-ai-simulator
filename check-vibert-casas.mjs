import Firecrawl from '@mendable/firecrawl-js';
const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

console.log("=== SCRAPEANDO /casas de ViBert ===\n");
const result = await firecrawl.scrapeUrl("https://www.vibert.com.ar/casas", {
  formats: ['markdown']
});
console.log(result.markdown);

import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

const firecrawl = new Firecrawl({
  apiKey: 'fc-e677ce7e82c2494698e7e3800b1e7efd'
});

const schema = z.object({
  companyName: z.string().optional(),
  models: z.array(z.object({
    name: z.string().optional(),
    squareMeters: z.number().optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
  })).optional()
});

console.log('Testing Firecrawl with vibert.com.ar...');

try {
  const result = await firecrawl.scrapeUrl('https://vibert.com.ar', {
    formats: ['extract'],
    extract: { schema }
  });
  
  console.log('Success:', result.success);
  console.log('Extract:', JSON.stringify(result.extract, null, 2));
  
  if (result.extract?.models) {
    console.log('\n=== MODELOS ENCONTRADOS ===');
    for (const m of result.extract.models) {
      console.log(`- ${m.name}: ${m.squareMeters}m², ${m.bedrooms} dorm, ${m.bathrooms} baño`);
    }
  }
} catch (error) {
  console.error('Error:', error);
}

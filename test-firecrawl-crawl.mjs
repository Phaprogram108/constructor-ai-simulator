// Test de crawling con Firecrawl
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({
  apiKey: 'fc-e677ce7e82c2494698e7e3800b1e7efd'
});

console.log('=== TEST 1: Map URLs ===');
try {
  const mapResult = await firecrawl.mapUrl('https://vibert.com.ar', {
    limit: 30
  });
  console.log('Map success:', mapResult.success);
  console.log('URLs found:', mapResult.links?.length || 0);
  if (mapResult.links) {
    console.log('Sample URLs:');
    for (const url of mapResult.links.slice(0, 10)) {
      console.log(' -', url);
    }
  }
} catch (e) {
  console.error('Map error:', e.message);
}

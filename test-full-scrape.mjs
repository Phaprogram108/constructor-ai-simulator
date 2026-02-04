import { readFileSync } from 'fs';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
      process.env[key] = value;
    }
  }
});

const { scrapeWithFirecrawl } = await import('./src/lib/firecrawl.ts');

async function test() {
  console.log('Testing FULL exhaustive scrape for vibert.com.ar...\n');
  
  const startTime = Date.now();
  const result = await scrapeWithFirecrawl('https://vibert.com.ar', { exhaustive: true });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n============================================================');
  console.log('Scraping completed in ' + elapsed + ' seconds');
  console.log('============================================================');
  console.log('Company: ' + result.title);
  console.log('Description: ' + (result.description || '').substring(0, 200));
  console.log('\nModels found: ' + (result.models?.length || 0));
  
  if (result.models && result.models.length > 0) {
    console.log('\nMODELS EXTRACTED (as formatted strings):');
    console.log('------------------------------------------------------------');
    result.models.forEach((modelStr, i) => {
      console.log((i+1) + '. ' + modelStr);
    });
  }
  
  console.log('\nContact: ' + result.contactInfo);
  console.log('\nServices: ' + (result.services || []).join(', '));
}

test().catch(e => console.error('Error:', e));

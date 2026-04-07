import Firecrawl from '@mendable/firecrawl-js';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key) envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const firecrawl = new Firecrawl({
  apiKey: envVars.FIRECRAWL_API_KEY
});

async function testExhaustive() {
  console.log('🔥 Testing Firecrawl exhaustive scraping for vibert.com.ar...');
  console.log('API Key:', envVars.FIRECRAWL_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('');

  // Step 1: Map all URLs
  console.log('Step 1: Mapping ALL URLs...');
  const mapResult = await firecrawl.mapUrl('https://vibert.com.ar', { limit: 100 });

  if (!mapResult.success) {
    console.log('❌ Map failed:', mapResult.error);
    return;
  }

  console.log('✅ Found', mapResult.links.length, 'URLs');
  console.log('');

  // Filter out static assets
  const EXCLUDED = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.pdf', '.css', '.js', '.woff'];
  const contentUrls = mapResult.links.filter(u => {
    const lower = u.toLowerCase();
    return !EXCLUDED.some(ext => lower.endsWith(ext));
  });

  console.log('📄 Content URLs (excluding assets):', contentUrls.length);
  console.log('💰 Estimated cost:', contentUrls.length, 'credits');
  console.log('');
  console.log('URLs to scrape:');
  contentUrls.forEach((url, i) => console.log(`  ${i+1}. ${url}`));
}

testExhaustive().catch(e => console.log('❌ Error:', e.message));

import { NextRequest, NextResponse } from 'next/server';
import { appendLeadRow, LeadPayload } from '@/lib/google-sheets';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Sheets append. Originally fire-and-forget, but in Vercel's Node runtime
// the serverless function can terminate before an un-awaited promise
// resolves — so leads were arriving in Redis but never in the Sheet. We
// now await it, wrapped in try/catch so any Sheets failure doesn't break
// the lead capture response.
async function dispatchToSheets(payload: LeadPayload): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  try {
    await appendLeadRow(payload);
  } catch (err) {
    console.warn('[Leads] Sheets append failed:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    // Accept both simulator leads (whatsapp + websiteUrl) and qualification leads
    if (type === 'qualification') {
      if (!body.publicidad || !body.consultasMes || !body.facturacionAnual) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
    } else {
      if (!body.whatsapp || !body.websiteUrl) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
    }

    const leadId = `lead:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const leadPayload = { ...body, type: type || 'simulator', id: leadId };
    const leadData = JSON.stringify(leadPayload);

    if (UPSTASH_URL && UPSTASH_TOKEN) {
      // Store in Upstash Redis with no expiry
      await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(leadId)}/${encodeURIComponent(leadData)}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });

      // Also add to a leads list for easy retrieval
      await fetch(`${UPSTASH_URL}/lpush/leads:all/${encodeURIComponent(leadData)}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });
    } else {
      console.log('[Leads] No Redis configured, logging lead:', leadData);
    }

    // Mirror to Google Sheets for Prometeo / WhatsApp outreach.
    // Awaited so the serverless function doesn't kill the request mid-flight.
    await dispatchToSheets(leadPayload);

    return NextResponse.json({ ok: true, id: leadId });
  } catch (error) {
    console.error('[Leads] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET endpoint to retrieve all leads (protected with API key)
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
    const expectedKey = process.env.LEADS_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return NextResponse.json({ error: 'No Redis configured' }, { status: 503 });
    }

    const response = await fetch(`${UPSTASH_URL}/lrange/leads:all/0/-1`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });

    const data = await response.json();
    const leads = (data.result || []).map((item: string) => JSON.parse(item));

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('[Leads] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

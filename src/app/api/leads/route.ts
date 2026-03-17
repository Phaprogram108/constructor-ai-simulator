import { NextRequest, NextResponse } from 'next/server';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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
    const leadData = JSON.stringify({ ...body, type: type || 'simulator' });

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

// TEMPORARY debug endpoint to diagnose why /api/leads isn't writing to the
// Sheet. Remove this file once the integration is confirmed working.
//
// Returns the exact error message the service-account flow produces.
// Access via: GET /api/debug-sheets?key=<LEADS_API_KEY>

import { NextRequest, NextResponse } from 'next/server';
import { appendLeadRow } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
  const expectedKey = process.env.LEADS_API_KEY;
  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized (need ?key=LEADS_API_KEY)' }, { status: 401 });
  }

  const envPresent = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const envLen = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.length ?? 0;

  let envParses = false;
  let envEmail: string | null = null;
  let envProject: string | null = null;
  try {
    const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}');
    envParses = true;
    envEmail = sa.client_email ?? null;
    envProject = sa.project_id ?? null;
  } catch (err) {
    return NextResponse.json({
      envPresent,
      envLen,
      envParses: false,
      parseError: String(err),
    });
  }

  let appendOk = false;
  let appendError: string | null = null;
  try {
    await appendLeadRow({
      whatsapp: '+5491100debug',
      websiteUrl: 'https://debug-sheets-endpoint.test',
      createdAt: new Date().toISOString(),
      type: 'debug',
      id: `debug-${Date.now()}`,
    });
    appendOk = true;
  } catch (err) {
    appendError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    envPresent,
    envLen,
    envParses,
    envEmail,
    envProject,
    appendOk,
    appendError,
  });
}

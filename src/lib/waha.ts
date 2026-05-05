const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_ENABLED = process.env.WAHA_ENABLED === 'true';
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Sends a WhatsApp text message through the WAHA HTTP API.
 *
 * - Skips silently if WAHA_ENABLED is not "true" or env is missing.
 * - Normalizes the destination number to digits-only E.164 (no leading +).
 * - Uses Upstash Redis (if configured) as a 24h rate-limit per number to
 *   avoid spamming the same lead on duplicate submissions.
 *
 * Throws on non-2xx WAHA responses so the caller can log the failure.
 */
export async function sendWahaMessage(toNumber: string, text: string): Promise<void> {
  if (!WAHA_ENABLED) {
    console.log('[WAHA] disabled, skipping send');
    return;
  }
  if (!WAHA_BASE_URL || !WAHA_API_KEY) {
    console.warn('[WAHA] missing env, skipping');
    return;
  }

  const cleanNumber = toNumber.replace(/\D/g, '');
  if (cleanNumber.length < 10) {
    console.warn('[WAHA] number too short, skipping:', cleanNumber);
    return;
  }

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const rateKey = `waha:sent:${cleanNumber}`;
    const checkRes = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(rateKey)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const checkData = await checkRes.json();
    if (checkData.result) {
      console.log('[WAHA] rate limited, skipping:', cleanNumber);
      return;
    }
  }

  const chatId = `${cleanNumber}@c.us`;
  const res = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_API_KEY,
    },
    body: JSON.stringify({ session: WAHA_SESSION, chatId, text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '<no body>');
    throw new Error(`WAHA send failed ${res.status}: ${errText.slice(0, 200)}`);
  }

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const rateKey = `waha:sent:${cleanNumber}`;
    await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(rateKey)}/sent?EX=86400`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  }

  console.log('[WAHA] sent ok to', cleanNumber);
}

export const WAHA_LEAD_MESSAGE = 'Gracias por probar el agente IA! Este es mi número personal por cualquier consulta. La web es https://agenteiagratis.com/ ¿Te gustó el agente?';

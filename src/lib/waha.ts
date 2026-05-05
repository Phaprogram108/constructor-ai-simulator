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

  const rawDigits = toNumber.replace(/\D/g, '');
  if (rawDigits.length < 10) {
    console.warn('[WAHA] number too short, skipping:', rawDigits);
    return;
  }

  // Argentina mobile normalization for the WhatsApp chatId.
  //
  // AR users type numbers in many forms: "223 540 7633", "0223 540 7633",
  // "9 223 540 7633", "+54 9 ...". The phone input concatenates the dial code
  // verbatim, so by the time we get here the digits can be:
  //   54 0 <area> <local>   → leading 0 in the local format (must drop)
  //   54 <area> <local>     → missing the mobile "9"
  //   549 <area> <local>    → already canonical
  // WhatsApp only delivers to AR mobiles when the chatId has the "9" between
  // country code and area code, and never has the "0".
  let cleanNumber = rawDigits;
  if (cleanNumber.startsWith('54') && cleanNumber.length >= 11) {
    let rest = cleanNumber.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (!rest.startsWith('9') && rest.length >= 10) rest = '9' + rest;
    cleanNumber = '54' + rest;
  }
  if (cleanNumber !== rawDigits) {
    console.log('[WAHA] AR mobile normalization:', rawDigits, '->', cleanNumber);
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

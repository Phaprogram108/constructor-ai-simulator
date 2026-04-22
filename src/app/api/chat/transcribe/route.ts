import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { rateLimit } from '@/lib/rate-limiter';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB — plenty for ~10min of opus

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'create');
  if (limited) return limited;

  const form = await request.formData();
  const audio = form.get('audio');

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'No se recibió el audio.' }, { status: 400 });
  }

  if (audio.size === 0) {
    return NextResponse.json({ error: 'El audio está vacío.' }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'El audio excede el tamaño máximo (10MB).' }, { status: 413 });
  }

  try {
    const mime = audio.type || 'audio/webm';
    const ext = mime.includes('mp4') ? 'mp4' : mime.includes('wav') ? 'wav' : 'webm';
    const file = new File([audio], `recording.${ext}`, { type: mime });

    const result = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'es',
    });

    return NextResponse.json({ text: result.text ?? '' });
  } catch (err) {
    console.error('[Transcribe] Whisper error:', err);
    return NextResponse.json(
      { error: 'No pudimos transcribir el audio. Intentá de nuevo.' },
      { status: 500 },
    );
  }
}

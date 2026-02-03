import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  sessionId: string;
  message: string;
  systemPrompt: string;
  conversationHistory: ChatMessage[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { message, systemPrompt, conversationHistory } = body;

    // Validate request
    if (!message) {
      return NextResponse.json(
        { error: 'El mensaje es requerido' },
        { status: 400 }
      );
    }

    if (!systemPrompt) {
      return NextResponse.json(
        { error: 'Sesión inválida. Creá una nueva sesión.' },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'El mensaje es demasiado largo (máx 1000 caracteres)' },
        { status: 400 }
      );
    }

    // Prepare messages for OpenAI
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Call OpenAI - using gpt-5.1 for best quality responses
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: openaiMessages,
      max_completion_tokens: 600,
      temperature: 0.7,
    });

    const assistantContent = completion.choices[0]?.message?.content ||
      'Disculpá, hubo un problema. ¿Podés repetir tu consulta?';

    return NextResponse.json({
      message: assistantContent,
    });
  } catch (error) {
    console.error('Chat error:', error);

    // Handle OpenAI specific errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Servicio temporalmente ocupado. Intentá en unos segundos.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al procesar el mensaje. Intentá de nuevo.' },
      { status: 500 }
    );
  }
}

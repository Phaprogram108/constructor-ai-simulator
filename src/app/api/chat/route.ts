import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logConversation } from '@/lib/conversation-logger';
import { Message } from '@/types';

// Inicialización lazy para evitar errores durante el build
let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  sessionId: string;
  message: string;
  systemPrompt: string;
  conversationHistory: ChatMessage[];
  companyName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { sessionId, message, systemPrompt, conversationHistory, companyName } = body;

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
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.1',
      messages: openaiMessages,
      max_completion_tokens: 600,
      temperature: 0.7,
    });

    const assistantContent = completion.choices[0]?.message?.content ||
      'Disculpá, hubo un problema. ¿Podés repetir tu consulta?';

    // Log conversation to file after each exchange
    try {
      const allMessages: Message[] = [
        ...(conversationHistory || []).map((msg, idx) => ({
          id: `hist-${idx}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(),
        })),
        {
          id: `user-${Date.now()}`,
          role: 'user' as const,
          content: message,
          timestamp: new Date(),
        },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: assistantContent,
          timestamp: new Date(),
        },
      ];

      logConversation(
        sessionId || 'unknown',
        companyName || 'Constructora',
        allMessages
      );
    } catch (logError) {
      console.error('[Chat] Error logging conversation:', logError);
      // Don't fail the request if logging fails
    }

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

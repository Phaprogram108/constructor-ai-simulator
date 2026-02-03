import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { getSession, addMessage, getMessagesRemaining, getSessionMessages } from '@/lib/session-manager';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';
import { ChatRequest, ChatResponse, Message } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Esperá un momento.' },
        { status: 429 }
      );
    }

    const body: ChatRequest = await request.json();
    const { sessionId, message } = body;

    // Validate request
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'sessionId y message son requeridos' },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'El mensaje es demasiado largo (máx 1000 caracteres)' },
        { status: 400 }
      );
    }

    // Get session
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada o expirada. Creá una nueva sesión.' },
        { status: 404 }
      );
    }

    // Check message limit
    const remaining = getMessagesRemaining(sessionId);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de mensajes para esta sesión.' },
        { status: 403 }
      );
    }

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    addMessage(sessionId, userMessage);

    // Prepare messages for OpenAI
    const sessionMessages = getSessionMessages(sessionId);
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: session.systemPrompt },
      ...sessionMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantContent = completion.choices[0]?.message?.content ||
      'Disculpá, hubo un problema. ¿Podés repetir tu consulta?';

    // Add assistant message
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
    };
    addMessage(sessionId, assistantMessage);

    const response: ChatResponse = {
      message: assistantContent,
      messagesRemaining: getMessagesRemaining(sessionId),
    };

    return NextResponse.json(response);
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

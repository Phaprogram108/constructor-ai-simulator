import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { appendEnhancedMessage } from '@/lib/conversation-logger';
import { Message, ScrapedContent } from '@/types';
import { validateResponse, ValidationResult } from '@/lib/response-validator';
import { ExtractedCatalog } from '@/lib/pdf-extractor';

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
  // Campos opcionales para validacion de respuestas (backwards compatible)
  scrapedContent?: ScrapedContent;
  catalog?: ExtractedCatalog;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { sessionId, message, systemPrompt, conversationHistory, scrapedContent, catalog } = body;

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

    // Validar respuesta si tenemos el contenido scrapeado
    let validationResult: ValidationResult | null = null;

    if (scrapedContent) {
      validationResult = validateResponse(assistantContent, scrapedContent, catalog);

      if (!validationResult.isValid) {
        console.warn('[Chat] Respuesta con posibles alucinaciones:', {
          sessionId,
          issues: validationResult.issues,
          confidence: validationResult.confidence,
        });
      }
    }

    // Log messages to enhanced logger
    try {
      // Crear mensaje del usuario
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      // Crear mensaje del asistente
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      // Agregar ambos mensajes al enhanced log
      appendEnhancedMessage(sessionId || 'unknown', userMessage);
      appendEnhancedMessage(sessionId || 'unknown', assistantMessage, validationResult || undefined);
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

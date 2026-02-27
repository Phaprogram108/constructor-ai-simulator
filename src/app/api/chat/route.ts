import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { appendEnhancedMessage } from '@/lib/conversation-logger';
import { getSession } from '@/lib/session-manager';
import { Message, ScrapedContent } from '@/types';
import { validateResponse, ValidationResult } from '@/lib/response-validator';
import { ExtractedCatalog } from '@/lib/pdf-extractor';
import { rateLimit, checkWeeklyChatLimit, getClientFingerprint } from '@/lib/rate-limiter';
import { trackEvent } from '@/lib/analytics-tracker';

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
  conversationHistory: ChatMessage[];
  companyName?: string;
  websiteUrl?: string;
  // Campos opcionales para validacion de respuestas (backwards compatible)
  scrapedContent?: ScrapedContent;
  catalog?: ExtractedCatalog;
}

// Patterns that indicate the AI doesn't have enough info to answer
const NO_INFO_PATTERNS = [
  /no tengo (?:esa )?informaci[oó]n/i,
  /no (?:tengo|cuento con).*(?:cargad|disponible|espec[ií]fic)/i,
  /contact[aá](?:nos|me) por whatsapp.*(?:detalle|info)/i,
  /no puedo (?:acceder|verificar)/i,
];

function responseNeedsResearch(response: string): boolean {
  return NO_INFO_PATTERNS.some(p => p.test(response));
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'chat');
    if (rateLimitResponse) return rateLimitResponse;

    // Weekly chat limit: 20 messages per IP per week
    const fingerprint = getClientFingerprint(request);
    const weeklyCheck = checkWeeklyChatLimit(fingerprint);
    if (!weeklyCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Has alcanzado el límite de testeo gratuito semanal (20 mensajes). Si querés un agente para tu empresa, contactanos.',
          code: 'CHAT_LIMIT_REACHED',
        },
        { status: 429 }
      );
    }

    const body: ChatRequestBody = await request.json();
    const { sessionId, message, conversationHistory, scrapedContent, catalog, websiteUrl } = body;

    // Validate request
    if (!message) {
      return NextResponse.json(
        { error: 'El mensaje es requerido' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Sesión inválida. Creá una nueva sesión.' },
        { status: 400 }
      );
    }

    // Retrieve systemPrompt from server-side session (never trust client)
    const session = await getSession(sessionId);
    if (!session) {
      trackEvent('session_errors');
      return NextResponse.json(
        { error: 'Sesión expirada o inválida. Creá una nueva sesión.' },
        { status: 401 }
      );
    }

    const systemPrompt = session.systemPrompt;

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'El mensaje es demasiado largo (máx 1000 caracteres)' },
        { status: 400 }
      );
    }

    // Limit conversation history to prevent payload abuse
    if (conversationHistory && conversationHistory.length > 50) {
      return NextResponse.json(
        { error: 'Historial de conversación demasiado largo.' },
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

    // On-demand re-search: detect "no info" and try to find content on the website
    let finalContent = assistantContent;
    let researched = false;

    if (responseNeedsResearch(assistantContent) && websiteUrl) {
      console.log('[Chat] Response needs research, triggering on-demand search...');
      try {
        const researchResponse = await fetch(
          `${request.nextUrl.origin}/api/chat/research`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ websiteUrl, query: message }),
          }
        );
        const research = await researchResponse.json();

        if (research.found && research.content) {
          const researchMessages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...(conversationHistory || []).map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            })),
            { role: 'user', content: message },
            { role: 'assistant', content: assistantContent },
            {
              role: 'user',
              content: `INFORMACION ADICIONAL ENCONTRADA EN EL SITIO WEB:\n\n${research.content}\n\nCon esta nueva informacion, responde la pregunta original del cliente de forma completa. Si la informacion responde a lo que pregunto, dala. Si no es relevante, mantene tu respuesta anterior.`,
            },
          ];

          const researchCompletion = await getOpenAI().chat.completions.create({
            model: 'gpt-5.1',
            messages: researchMessages,
            max_completion_tokens: 600,
            temperature: 0.7,
          });

          const researchContent = researchCompletion.choices[0]?.message?.content;
          if (researchContent) {
            finalContent = researchContent;
            researched = true;
            console.log('[Chat] Research improved response');
          }
        }
      } catch (researchError) {
        console.error('[Chat] Research failed:', researchError);
        // Continue with original response - graceful degradation
      }
    }

    // Validar respuesta si tenemos el contenido scrapeado
    let validationResult: ValidationResult | null = null;

    if (scrapedContent) {
      validationResult = validateResponse(finalContent, scrapedContent, catalog);

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
        content: finalContent,
        timestamp: new Date(),
      };

      // Agregar ambos mensajes al enhanced log
      appendEnhancedMessage(sessionId || 'unknown', userMessage);
      appendEnhancedMessage(sessionId || 'unknown', assistantMessage, validationResult || undefined);
    } catch (logError) {
      console.error('[Chat] Error logging conversation:', logError);
      // Don't fail the request if logging fails
    }

    trackEvent('chats_sent');

    return NextResponse.json({
      message: finalContent,
      researched,
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

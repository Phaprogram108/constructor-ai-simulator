import { NextRequest, NextResponse } from 'next/server';
import { getSession, getMessagesRemaining, getSessionMessages } from '@/lib/session-manager';
import { rateLimit } from '@/lib/rate-limiter';
import { SessionInfo } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimit(request, 'session');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Session ID requerido' },
        { status: 400 }
      );
    }

    const session = await getSession(id);
    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada o expirada' },
        { status: 404 }
      );
    }

    const sessionInfo: SessionInfo = {
      id: session.id,
      companyName: session.companyName,
      messagesRemaining: await getMessagesRemaining(id),
      expiresAt: session.expiresAt,
    };

    const messages = await getSessionMessages(id);

    return NextResponse.json({
      session: sessionInfo,
      messages,
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { error: 'Error al obtener la sesión' },
      { status: 500 }
    );
  }
}

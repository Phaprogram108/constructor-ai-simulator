'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import { Message, SessionInfo } from '@/types';

export default function DemoPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Try to get session from localStorage
    const storedSession = localStorage.getItem(`session-${params.sessionId}`);

    if (storedSession) {
      try {
        const data = JSON.parse(storedSession);
        setSession(data.session);
        setMessages(data.messages || []);
        setSystemPrompt(data.systemPrompt || '');
        setLoading(false);
      } catch {
        setError('Error al cargar la sesión');
        setLoading(false);
      }
    } else {
      setError('Sesión no encontrada o expirada. Creá una nueva.');
      setLoading(false);
    }
  }, [params.sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando chat...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sesión no disponible</h2>
          <p className="text-gray-600 mb-6">{error || 'La sesión expiró o no existe.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Crear nueva sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatInterface
      sessionId={params.sessionId}
      initialSession={session}
      initialMessages={messages}
      systemPrompt={systemPrompt}
    />
  );
}

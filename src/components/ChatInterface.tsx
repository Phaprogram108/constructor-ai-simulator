'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Message, { TypingIndicator } from '@/components/Message';
import { Message as MessageType, SessionInfo } from '@/types';

interface ChatInterfaceProps {
  sessionId: string;
  initialSession: SessionInfo;
  initialMessages: MessageType[];
}

export default function ChatInterface({
  sessionId,
  initialSession,
  initialMessages,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageType[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [messagesRemaining, setMessagesRemaining] = useState(initialSession.messagesRemaining);
  const [error, setError] = useState('');
  const [weeklyLimitReached, setWeeklyLimitReached] = useState(false);

  // Debug logging
  console.log('[ChatInterface] Initialized with:', {
    sessionId,
    companyName: initialSession.companyName,
    messagesRemaining: initialSession.messagesRemaining,
    messagesCount: initialMessages.length,
    firstMessage: initialMessages[0]?.content?.slice(0, 100),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || messagesRemaining <= 0 || weeklyLimitReached) return;

    const userMessage = input.trim();
    setInput('');
    setError('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMessage: MessageType = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    const searchingTimer = setTimeout(() => setIsSearching(true), 6000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
          websiteUrl: initialSession.websiteUrl,
          companyName: initialSession.companyName,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'CHAT_LIMIT_REACHED') {
          setWeeklyLimitReached(true);
          setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
          return;
        }
        throw new Error(data.error || 'Error al enviar mensaje');
      }

      // Add assistant message and persist full conversation
      const assistantMessage: MessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      // Update state and get the new messages array for persistence
      const updatedMessages = [...messages, tempUserMessage, assistantMessage];
      setMessages(prev => [...prev, assistantMessage]);

      // Decrement messages locally and persist to localStorage
      const newMessagesRemaining = messagesRemaining - 1;
      setMessagesRemaining(newMessagesRemaining);

      // Update localStorage with new count AND full message history
      const storedSession = localStorage.getItem(`session-${sessionId}`);
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          sessionData.session.messagesRemaining = newMessagesRemaining;
          // Persist full conversation history
          sessionData.messages = updatedMessages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }));
          localStorage.setItem(`session-${sessionId}`, JSON.stringify(sessionData));
          console.log('[ChatInterface] Persisted conversation:', updatedMessages.length, 'messages');
        } catch {
          // Ignore localStorage errors
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      clearTimeout(searchingTimer);
      setIsSearching(false);
      setIsLoading(false);
      // Use setTimeout to ensure focus happens after React re-render
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3">
          {/* Botón volver al inicio */}
          <a
            href="/"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            title="Volver al inicio"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold">S</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Sofia</h1>
            <p className="text-xs text-gray-500">{initialSession.companyName}</p>
          </div>
        </div>
        {/* CTA button instead of message counter */}
        <a
          href="/#califica"
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full transition-colors"
        >
          Verificá si calificás
        </a>
      </header>

      {/* CTA Banner */}
      <a
        href="/#califica"
        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 transition-colors"
      >
        <span className="font-medium">¿Te gustaría que este agente trabaje para tu constructora 24/7?</span>
        <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">Verificá si calificás</span>
      </a>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {isLoading && (
          isSearching ? (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">S</span>
                  </div>
                  <span className="text-xs font-medium text-blue-600">Sofia</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Buscando informacion adicional en el sitio web...
                </div>
              </div>
            </div>
          ) : (
            <TypingIndicator />
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Weekly limit banner */}
      {weeklyLimitReached && (
        <div className="mx-4 mb-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-center text-white">
          <h3 className="text-lg font-bold mb-2">¿Te gustaría que este agente trabaje para tu constructora 24/7?</h3>
          <p className="text-blue-100 text-sm mb-3">Llegaste al límite semanal. El Programa PHA incluye un agente IA personalizado, publicidad y CRM — todo gestionado por un equipo dedicado.</p>
          <a
            href="/#califica"
            className="inline-block bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
          >
            Verificá si tu constructora califica
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 bg-red-50 text-red-600 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white p-4">
        {weeklyLimitReached ? (
          <div className="text-center py-2">
            <p className="text-gray-400 text-sm">
              Chat deshabilitado - l&iacute;mite semanal alcanzado
            </p>
          </div>
        ) : messagesRemaining > 0 ? (
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu mensaje..."
              disabled={isLoading}
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="shrink-0 h-[44px] w-[44px]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </Button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-center text-white">
            <h3 className="text-xl font-bold mb-2">¿Te gustaría que este agente trabaje para tu constructora 24/7?</h3>
            <p className="text-blue-100 mb-4">Este fue solo un demo. El Programa PHA incluye un agente IA personalizado, publicidad y CRM — todo gestionado por un equipo dedicado.</p>
            <a
              href="/#califica"
              className="inline-block bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-full font-bold transition-colors"
            >
              Verificá si tu constructora califica
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

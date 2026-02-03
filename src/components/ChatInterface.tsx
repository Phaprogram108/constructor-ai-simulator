'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  const [messagesRemaining, setMessagesRemaining] = useState(initialSession.messagesRemaining);
  const [error, setError] = useState('');

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
    if (!input.trim() || isLoading || messagesRemaining <= 0) return;

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar mensaje');
      }

      // Add assistant message
      const assistantMessage: MessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setMessagesRemaining(data.messagesRemaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isLowMessages = messagesRemaining <= 10;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold">S</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Sofia</h1>
            <p className="text-xs text-gray-500">{initialSession.companyName}</p>
          </div>
        </div>
        <Badge variant={isLowMessages ? 'destructive' : 'secondary'}>
          {messagesRemaining} mensajes
        </Badge>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 bg-red-50 text-red-600 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white p-4">
        {messagesRemaining > 0 ? (
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
          <div className="text-center py-4">
            <p className="text-gray-500 mb-3">
              Has alcanzado el límite de mensajes para esta demo.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
            >
              Crear Nueva Sesión
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { Message as MessageType } from '@/types';

// Función para renderizar Markdown básico (negritas, itálicas, listas)
function renderMarkdown(text: string): React.ReactNode {
  // Dividir por líneas para manejar listas
  const lines = text.split('\n');

  const processLine = (line: string, index: number): React.ReactNode => {
    // Procesar negritas **texto** -> <strong>texto</strong>
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      // Texto antes del match
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      // Texto en negrita
      parts.push(<strong key={`bold-${index}-${match.index}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    // Texto restante después del último match
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    // Si no hubo matches, devolver la línea original
    if (parts.length === 0) {
      parts.push(line);
    }

    // Detectar si es un item de lista
    const isListItem = /^[-•]\s/.test(line.trim());

    if (isListItem) {
      return (
        <div key={index} className="flex gap-2 ml-2">
          <span>•</span>
          <span>{parts}</span>
        </div>
      );
    }

    return <span key={index}>{parts}{index < lines.length - 1 ? '\n' : ''}</span>;
  };

  return lines.map((line, index) => processLine(line, index));
}

interface MessageProps {
  message: MessageType;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        )}
      >
        {/* Avatar for assistant */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-semibold">S</span>
            </div>
            <span className="text-xs font-medium text-blue-600">Sofia</span>
          </div>
        )}

        {/* Message content with Markdown support */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {renderMarkdown(message.content)}
        </div>

        {/* Timestamp */}
        <p
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-blue-200' : 'text-gray-400'
          )}
        >
          {timestamp}
        </p>
      </div>
    </div>
  );
}

// Typing indicator component
export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">S</span>
          </div>
          <span className="text-xs font-medium text-blue-600">Sofia</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

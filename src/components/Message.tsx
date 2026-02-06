'use client';

import { cn } from '@/lib/utils';
import { Message as MessageType } from '@/types';

// Función para renderizar Markdown básico (negritas, itálicas, listas, links)
function renderMarkdown(text: string, isUserMessage = false): React.ReactNode {
  const lines = text.split('\n');
  const linkClass = isUserMessage
    ? 'text-white underline hover:text-blue-100 break-all'
    : 'text-blue-600 underline hover:text-blue-800 break-all';

  // Procesar inline: negritas y URLs
  const processInline = (str: string, lineIndex: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Regex que matchea **bold**, [text](url), o URLs sueltas
    const inlineRegex = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s,;)]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }

      if (match[1]) {
        parts.push(<strong key={`b-${lineIndex}-${match.index}`}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(
          <a
            key={`l-${lineIndex}-${match.index}`}
            href={match[5]}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {match[4]}
          </a>
        );
      } else if (match[6]) {
        const url = match[6].replace(/[.,;:!?]+$/, '');
        const trailing = match[6].slice(url.length);
        parts.push(
          <a
            key={`u-${lineIndex}-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {url}
          </a>
        );
        if (trailing) parts.push(trailing);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }

    if (parts.length === 0) {
      parts.push(str);
    }

    return parts;
  };

  const processLine = (line: string, index: number): React.ReactNode => {
    const inlineParts = processInline(line, index);

    // Detectar si es un item de lista
    const isListItem = /^[-•]\s/.test(line.trim());

    if (isListItem) {
      return (
        <div key={index} className="flex gap-2 ml-2">
          <span>•</span>
          <span>{inlineParts}</span>
        </div>
      );
    }

    return <span key={index}>{inlineParts}{index < lines.length - 1 ? '\n' : ''}</span>;
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
        <div className="text-[15px] md:text-sm whitespace-pre-wrap break-words leading-relaxed">
          {renderMarkdown(message.content, isUser)}
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

'use client';

import { cn } from '@/lib/utils';
import { Message as MessageType } from '@/types';

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

        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>

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

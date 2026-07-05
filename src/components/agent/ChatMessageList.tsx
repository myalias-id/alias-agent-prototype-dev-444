'use client';

import { Loader2 } from 'lucide-react';
import { RefObject } from 'react';

import { ChatPrivateMessageUI } from '@/components/chat';
import { cn } from '@/lib/utils';
import { Message } from '@/store/useSocketChatStore';

interface ChatMessageListProps {
  messages: Message[];
  isThinking: boolean;
  isDark: boolean;
  scrollRef: RefObject<HTMLDivElement>;
}

/**
 * Scrollable message feed with a thinking indicator.
 */
export function ChatMessageList({
  messages,
  isThinking,
  isDark,
  scrollRef,
}: ChatMessageListProps) {
  return (
    <div
      ref={scrollRef}
      className={cn(
        'h-full w-full overflow-y-scroll overflow-x-hidden scrollbar-thin',
        'scrollbar-track-gray-800 scrollbar-thumb-gray-600 flex flex-col',
        'px-5 pr-[10px]'
      )}
      style={{
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
        position: 'relative',
        maskImage:
          'linear-gradient(to bottom, transparent 2%, black 100px, black 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 2%, black 100px, black 100%)',
      }}>
      {/* Spacer pushes messages to bottom initially */}
      <div className="flex-1 min-h-0" />

      {messages.map((msg) => (
        <ChatPrivateMessageUI key={msg.id} msg={msg} />
      ))}

      {isThinking && (
        <div
          className={cn(
            'flex items-center mt-2 body-2 w-fit py-[16px] flex-wrap rounded-[30px] text-foreground',
            isDark && 'text-white'
          )}>
          <Loader2
            size={16}
            className={cn(
              'text-foreground animate-spin',
              isDark && 'text-white'
            )}
          />
          <span
            className={cn(
              'ml-2 text-sm text-foreground/80',
              isDark && 'text-white/80'
            )}>
            Thinking...
          </span>
        </div>
      )}
    </div>
  );
}

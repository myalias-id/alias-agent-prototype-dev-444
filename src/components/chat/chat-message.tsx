import React from 'react';

import { MessageObject } from '@/components/blockchain-data/interfaces';

interface ChatMessageProps {
  message: MessageObject;
  platformColor: string;
}

const platformColors: Record<string, string> = {
  telegram: 'bg-[#8774e1]',
  kick: 'bg-backgroundSecondary',
};

export function ChatMessage({ message, platformColor }: ChatMessageProps) {
  return (
    <div
      className={`flex flex-col w-3/4 max-w-md min-w-[28rem] rounded-xl shadow-md p-4 ${platformColors[platformColor]} text-foreground`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-lg font-bold">
          {message.username.replace('@', '')}
        </span>
        <span className="text-sm">{message.platform}</span>
      </div>
      <div className="text-base">{message.text}</div>
    </div>
  );
}

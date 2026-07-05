'use client';

import React from 'react';

import { AvatarButton } from '@/components/buttons/avatar-button';
import { ChatPrivateMessageUI } from '@/components/chat';
import { Message } from '@/store/useSocketChatStore';
import { IAgent } from '@/types/agent';

interface AgentChatFullscreenCanvasProps {
  chatContainerRef: React.RefObject<HTMLDivElement>;
  agent: IAgent;
  messages: Message[];
}

export default function AgentChatFullScreenCanvas({
  chatContainerRef,
  agent,
  messages,
}: AgentChatFullscreenCanvasProps) {
  return (
    <>
      <div className="fixed top-5 left-5 z-[60] pointer-events-auto">
        <div className={`flex flex-row gap-4 items-center`}>
          <div className={`relative`}>
            <AvatarButton
              src={agent?.logo?.url || '/img/default-agent-logo.png'}
              alt={'Agent PFP'}
              height={84}
              width={84}
              className="rounded-lg"
              onClick={() => {}}
            />

            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 pr-2 pl-1 flex items-center gap-x-1 mx-auto rounded bg-black/40 backdrop-blur-[120px]">
              <p className="body-3 ">Live</p>
            </div>
          </div>

          <div className={`flex flex-1 flex-col justify-center`}>
            <h1>{agent?.name}</h1>
            <p className={`body-2 text-muted`}>@{agent?.slug}</p>
          </div>
        </div>
      </div>

      <div className="fixed top-5 right-5 w-1/5 h-full z-[60] pointer-events-auto">
        <div className="w-full h-full relative ">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <h2>Chat</h2>
          </div>

          <div className="relative h-[calc(100%-62px)] flex flex-col">
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto custom-scroll !overflow-x-hidden">
              <div className="h-full flex flex-col justify-end">
                <div className="flex flex-col max-h-[70vh] space-y-4 pb-4">
                  {messages.map((msg: Message) => {
                    return <ChatPrivateMessageUI key={msg.id} msg={msg} />;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-1/3 z-[60] pointer-events-auto">
        {/* <TextareaWithButton
          placeholder="Type your message"
          className={
            'text-sm font-geist placeholder:text-sm placeholder:font-geist px-0 py-2.5 pr-14 text-white placeholder:text-white/40 border-none'
          }
          containerClassName={
            'flex bg-black pl-6 items-center flex-row flex-nowrap rounded-md border border-lightWhite gap-x-2 transition-colors duration-200 focus-within:border-primary/40'
          }
          value={chatInputValue}
          onChange={(e) => setChatInputValue(e.target.value)}
          onSendClick={handleSend}  
          onMicClick={())}
          isRecording={recording}
          disabled={agentThinking}
          isDark={isDark}
          suggestedQuery={{
            text: 'What gigs are coming up?',
            count: 3,
          }}
        /> */}
      </div>
    </>
  );
}

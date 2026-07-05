import { Message as DBMessage } from '@/types/chat';

export interface ExtendedMessage extends DBMessage {
  tempId?: string;
}

export type Message = {
  id: string;
  isUser: boolean;
  content: string;
};

export interface SocketChatState {
  socket: WebSocket | null;
  messages: Message[];
  userId?: string;
  sessionId?: string;
  isConnecting: boolean;
  lastReconnectAttempt: number;
  connectionAttempts: number;
  currentMessageId: string | null;
  audioQueue: string[];
  isPlayingAudio: boolean;
  currentMessageText: string;
  hasReceivedAudio: boolean;
  isProcessing: boolean;
  currentEmotion: string | null;
  visualizerAnalyser: AnalyserNode | null;
  visualizerGainNode: GainNode | null;
  volume: number;
  /**
   * Whether a synthetic-speech turn is currently driving the VRM avatar.
   * Activates when the user is muted at the time of the first text chunk of
   * an agent turn (also covers the CMS `enableVoiceButton === false` case,
   * which forces volume to 0 on mount). When true, incoming audio chunks
   * for the same turn are dropped so the synthetic timeline owns the avatar
   * lifecycle (handleAudioStart / handleAudioEnd, mouth visemes).
   */
  syntheticSpeechActive: boolean;

  connect: (sendMessage?: boolean) => void;
  reconnect: () => void;
  leaveStream: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  playNextAudio: () => void;
  playAudioDirectly: (
    audioBuffer: ArrayBuffer,
    volume?: number
  ) => Promise<void>;
  setIsProcessing: (isProcessing: boolean) => void;
  interruptSpeech: () => void;
  stopAgent: () => void;
  setVolume: (volume: number) => void;
}

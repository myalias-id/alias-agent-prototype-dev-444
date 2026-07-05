import { toast } from 'sonner';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { MAX_RECONNECT_ATTEMPTS, RECONNECT_INTERVAL_MS } from '@/lib/constants';
import {
  isPreviewBridgeMode,
  sendPreviewBridgeRequest,
} from '@/lib/preview-bridge';
import { decodeBase64ToArrayBuffer } from '@/lib/utils/base64';
import { parseSocketResponse } from '@/lib/utils/chat-utils';
import { extractMessageText } from '@/lib/utils/parse-response';
import { playAudioDirectly as playAudioDirectlyService } from '@/store/socket-chat/audio-playback';
import {
  generateUUID,
  getChatGatewayUrl,
  startHealthCheck,
} from '@/store/socket-chat/connection';
import { notifyBackendAboutSession } from '@/store/socket-chat/session';
import { SocketChatState } from '@/store/socket-chat/types';
import {
  mapFacialEmotionToAnimation,
  mapFacialEmotionToVRM,
  voiceInstructionsStringHelper,
} from '@/store/socketChat.helpers';
import useAgentStore from '@/store/useAgentStore';
import useVRMStore from '@/store/vrmStore';

export type { ExtendedMessage, Message } from '@/store/socket-chat/types';

/**
 * @file This file contains the Zustand store for managing the real-time WebSocket chat connection.
 * It handles connecting to the chat gateway, sending and receiving messages, processing streaming
 * text and audio chunks, and coordinating with the VRM model for lip-sync and animations.
 */

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
/** Accumulates raw audio data for the current turn (reset on connect/turn-end). */
let audioBuffer: ArrayBuffer | null = null;
/** Accumulates text content for the current turn (reset on connect/turn-end). */
let _textContent = '';
/** Monotonically increasing counter — incremented on interrupt to cancel in-flight audio. */
let audioGeneration = 0;

type PreviewChatResult = {
  messages?: {
    structuredResponse?: Record<string, unknown> | null;
    text: string;
  }[];
  sessionId?: string;
};

type PreviewTtsResult = {
  audioBase64?: string;
};

/**
 * Zustand store for managing the real-time WebSocket chat.
 * @see {@link SocketChatState}
 */
const useSocketChatStore = create<SocketChatState>()(
  persist(
    (set, get) => ({
      socket: null,
      messages: [],
      userId: undefined,
      sessionId: undefined,
      isConnecting: false,
      lastReconnectAttempt: 0,
      connectionAttempts: 0,
      currentMessageId: null,
      audioQueue: [],
      isPlayingAudio: false,
      currentMessageText: '',
      hasReceivedAudio: false,
      isProcessing: false,
      currentEmotion: null,
      visualizerAnalyser: null,
      visualizerGainNode: null,
      volume: 0,
      syntheticSpeechActive: false,

      connect: (sendMessage = true) => {
        // Reset the audio buffer and text content on new connection
        audioBuffer = null;
        _textContent = '';

        // Don't attempt to connect if already connecting
        if (get().isConnecting) {
          return;
        }
        // Tear down any existing socket
        const existing = get().socket;
        if (existing) {
          existing.close();
          set({ socket: null });
        }

        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }

        if (isPreviewBridgeMode()) {
          set({
            connectionAttempts: 0,
            isConnecting: false,
            lastReconnectAttempt: 0,
            socket: null,
          });
          return;
        }

        set({ isConnecting: true });

        const ws = new WebSocket(getChatGatewayUrl());

        ws.onopen = () => {
          // Reset connection attempts on successful connection
          set({
            isConnecting: false,
            connectionAttempts: 0,
            lastReconnectAttempt: 0,
          });

          // Generate random userId if not already present
          const userId = get().userId || generateUUID();
          set({ userId });

          // Send initial message with userId and with sessionId if available
          const sessionId = get().sessionId;

          const { agent } = useAgentStore.getState();
          const resEngineDefaultName =
            process?.env?.NEXT_PUBLIC_DEFAULT_RESOURCE_ENGINE;

          if (sendMessage) {
            const locale = navigator.language;
            // Send initial message with preferred language
            ws.send(
              JSON.stringify({
                type: 'send_message',
                user_id: userId,
                message: `Starting new session. User has preferred language ${locale}. Reply in that language.`,
                tts_provider: 'openai',
                instructions: voiceInstructionsStringHelper(
                  agent?.voiceInstructions
                ),
                isMuted: get().volume === 0,
                engine_resource:
                  agent?.adkDeploymentResourceName || resEngineDefaultName,
                voice: agent?.voiceID,
                voice_speed: agent?.voiceSpeed || 1.15,
                per_user_rpm:
                  agent?.defaults?.messagesPerMinutePerUser || undefined,
                engine_rpm:
                  agent?.defaults?.overallMessagesPerMinute || undefined,
                max_tokens_per_msg:
                  agent?.defaults?.maximumTokensPerMessage || undefined,
                ...(sessionId ? { session_id: sessionId } : {}),
              })
            );
          }
          healthCheckInterval = startHealthCheck(ws, get().reconnect);
        };

        ws.onclose = (_event) => {
          set({ isConnecting: false });

          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
          }
          // Attempt to reconnect automatically unless manually disconnected
          get().reconnect();
        };

        ws.onerror = (error) => {
          console.error('[SocketChat] WebSocket error:', error);
          set({ isConnecting: false });
          // We'll let onclose handle reconnection
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Handle pong responses to our ping messages
            if (data?.type === 'pong') {
              return;
            }
            // Handle session ID updates
            if (data?.session_id && get().sessionId !== data.session_id) {
              set({ sessionId: data.session_id });
              const { userId } = get();
              const { agent, selectedAgent } = useAgentStore.getState();
              notifyBackendAboutSession(
                agent?.id ?? selectedAgent,
                userId,
                data.session_id
              );
              return;
            }
            // Handle error messages
            if (data?.error) {
              set({ isProcessing: false });
              console.error('[SocketChat] Server error:', data.error);
              toast.error('Error', {
                description: data.error,
                duration: 5000,
              });
              return;
            }
            // Handle text chunks
            if (data?.text_chunk) {
              set({ isProcessing: false });
              const { currentMessageId, messages } = get();
              const parsedResponse = parseSocketResponse(data?.text_chunk);

              const text = parsedResponse?.text;
              const facialEmotion = parsedResponse?.facial_emotion;
              const animToPlay = parsedResponse?.anim_to_play;
              const isFirstChunkOfNewMessage = currentMessageId === null;

              // If a synthetic-speech turn from a *previous* message is still
              // running when a new agent message starts, end it cleanly so the
              // new turn (which may be muted or unmuted) starts from a known
              // state.
              if (isFirstChunkOfNewMessage && get().syntheticSpeechActive) {
                const { currentVRM } = useVRMStore.getState();
                if (currentVRM?.model) {
                  currentVRM.model.stopSyntheticSpeech();
                  currentVRM.model.onSyntheticSpeechEnd = undefined;
                }
                set({ syntheticSpeechActive: false });
                useVRMStore.getState().handleAudioEnd();
              }

              // Update the current message text for VRM lip sync
              _textContent += text;
              // Handle facial emotion if provided
              if (facialEmotion) {
                const normalizedEmotion = facialEmotion.toLowerCase().trim();
                const { currentVRM } = useVRMStore.getState();
                if (currentVRM?.model?.emoteController) {
                  // Map the facial emotion to VRM expression preset
                  const emotionPreset = mapFacialEmotionToVRM(facialEmotion);
                  currentVRM.model.emoteController.playEmotion(emotionPreset);
                }

                // Persist the normalized emotion so audio playback can pick it up
                set({
                  currentEmotion:
                    mapFacialEmotionToAnimation(normalizedEmotion),
                });

                // ✅ Handle animation emotion change during conversation
                if (get().isPlayingAudio || get().syntheticSpeechActive) {
                  // Notify animation controller of emotion change
                  const controller = useVRMStore.getState().animationController;
                  if (controller) {
                    controller.onEmotionChange(
                      mapFacialEmotionToAnimation(normalizedEmotion)
                    );
                  }
                }
              }
              // Handle animation preference if provided
              if (animToPlay) {
                useVRMStore
                  .getState()
                  .setPendingAnimation(animToPlay.trim() || null);
              }
              // If this is the first chunk of a new message, create a new message
              if (currentMessageId === null) {
                const newMessageId = generateUUID();
                set({
                  currentMessageId: newMessageId,
                  currentMessageText: text,
                  hasReceivedAudio: false,
                });

                const newMessage = {
                  id: newMessageId,
                  isUser: false,
                  content: text,
                };

                set({ messages: [...messages, newMessage] });
              }
              // Otherwise, append to the existing message
              else {
                const updatedMessages = messages.map((msg) => {
                  if (msg.id === currentMessageId) {
                    return {
                      ...msg,
                      content: msg.content + text,
                    };
                  }
                  return msg;
                });

                set({
                  messages: updatedMessages,
                  currentMessageText: get().currentMessageText + text,
                });
              }

              // Synthetic-speech path: when the user is muted at the start of
              // an agent turn (and no real audio has arrived yet), drive the
              // VRM mouth + body talking animation from a length-based
              // estimate so the avatar still appears to talk silently. The
              // unmuted real-audio path is unaffected — this branch only
              // runs while `volume === 0` and the audio queue hasn't taken
              // ownership of the turn.
              const isMuted = get().volume === 0;
              if (
                isMuted &&
                get().currentMessageId &&
                !get().hasReceivedAudio
              ) {
                const { currentVRM } = useVRMStore.getState();
                const model = currentVRM?.model;
                if (model) {
                  const fullText = get().currentMessageText;
                  if (!get().syntheticSpeechActive) {
                    set({ syntheticSpeechActive: true });
                    const emotion = get().currentEmotion || 'neutral';
                    // Wire end-of-synthetic callback: when the model's
                    // synthetic timer elapses, close out the turn the same
                    // way the real-audio path does.
                    model.onSyntheticSpeechEnd = () => {
                      if (!get().syntheticSpeechActive) {
                        return;
                      }
                      set({
                        syntheticSpeechActive: false,
                        currentEmotion: null,
                      });
                      useVRMStore.getState().handleAudioEnd();
                    };
                    useVRMStore.getState().handleAudioStart(emotion);
                    model.startSyntheticSpeech(fullText);
                  } else {
                    model.extendSyntheticSpeech(fullText);
                  }
                }
              }

              return;
            }

            // Handle audio chunks
            if (data?.audio_chunk) {
              // Only process audio if we have an active message (text has started)
              // This ignores stale audio chunks from previous response after interrupt
              if (!get().currentMessageId) {
                return;
              }
              // Drop audio chunks when a synthetic-speech turn owns this
              // message. Synthetic only activates when the user was muted at
              // the start of the turn, so the user wouldn't hear this audio
              // anyway — unmuting mid-turn is intentionally treated as
              // "ignore the rest of this message" per product decision.
              if (get().syntheticSpeechActive) {
                return;
              }
              const { audioQueue, playNextAudio } = get();
              set({
                audioQueue: [...audioQueue, data.audio_chunk],
              });
              playNextAudio();
              return;
            }

            // Handle end of turn
            if (data?.end_of_turn) {
              // If we haven't received any audio but have accumulated text,
              // we can try to make the avatar speak one last time
              if (
                !get().hasReceivedAudio &&
                audioBuffer &&
                get().currentMessageText
              ) {
                const { currentVRM } = useVRMStore.getState();
                if (currentVRM?.model && !currentVRM.model.isSpeaking) {
                  try {
                    currentVRM.model.speakFromBuffer(
                      audioBuffer,
                      get().currentMessageText
                    );
                  } catch (err) {
                    console.error(
                      '[SocketChat] Error in final avatar speech attempt:',
                      err
                    );
                  }
                }
              }
              // Do NOT reset VRM to idle here; let it happen after speech/audio is finished
              // const { currentVRM } = useVRMStore.getState();
              // if (currentVRM?.model) {
              // resetVRMToIdle(currentVRM.model);
              // }
              // Reset for next turn
              audioBuffer = null;
              _textContent = '';
              set({
                currentMessageId: null,
                currentMessageText: '',
                hasReceivedAudio: false,
                isProcessing: false,
              });
              return;
            }
            // Legacy format handling (for backward compatibility)
            if (data?.content) {
              const messageText = extractMessageText(data);
              if (messageText) {
                const messageId = generateUUID();
                const newMessage = {
                  id: messageId,
                  isUser: false,
                  content: messageText || data.content,
                };

                const newMessages = [...get().messages, newMessage];
                set({ messages: newMessages });
                // Handle legacy audio if it exists
                if (data.audio) {
                  try {
                    const arrBuf = decodeBase64ToArrayBuffer(data.audio);
                    const { currentVRM } = useVRMStore.getState();
                    if (currentVRM?.model) {
                      currentVRM.model.speakFromBuffer(arrBuf, messageText);
                    }
                  } catch (err) {
                    console.error('[SocketChat] Legacy audio error:', err);
                  }
                }
              }
            }
          } catch (err) {
            console.error('[SocketChat] onmessage error:', err);
          }
        };

        set({ socket: ws });
      },

      reconnect: () => {
        const now = Date.now();
        const lastAttempt = get().lastReconnectAttempt;
        const attempts = get().connectionAttempts;
        // Implement exponential backoff for reconnection
        if (
          now - lastAttempt < RECONNECT_INTERVAL_MS * Math.pow(2, attempts) ||
          attempts >= MAX_RECONNECT_ATTEMPTS
        ) {
          return;
        }
        set({
          lastReconnectAttempt: now,
          connectionAttempts: attempts + 1,
        });
        // Attempt to reconnect
        get().connect(false);
      },

      leaveStream: () => {
        const sock = get().socket;
        const { sessionId } = get();
        if (sock && sock.readyState === WebSocket.OPEN && sessionId) {
          sock.send(
            JSON.stringify({ type: 'leaveStream', streamId: sessionId })
          );
        }
        set({ sessionId: null, messages: [] });
      },

      disconnect: () => {
        const sock = get().socket;
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }
        if (sock) {
          sock.close();
        }
        set({
          socket: null,
          messages: [],
          sessionId: null,
          isConnecting: false,
          // We keep userId to maintain identity between sessions
        });
      },

      sendMessage: (content: string) => {
        if (isPreviewBridgeMode()) {
          const newMessage = {
            id: generateUUID(),
            isUser: true,
            content,
          };
          set((state) => ({
            isProcessing: true,
            messages: [...state.messages, newMessage],
          }));

          void (async () => {
            const { agent, selectedAgent } = useAgentStore.getState();
            const requestAgentId = agent?.id ?? selectedAgent;

            try {
              const result = await sendPreviewBridgeRequest<
                { agentId?: number | null; sessionId?: string; text: string },
                PreviewChatResult
              >('alias-preview:sendMessage', 'alias-preview:messageResult', {
                agentId: requestAgentId,
                sessionId: get().sessionId,
                text: content,
              });

              const assistantMessages = result.messages?.length
                ? result.messages
                : [{ text: '(No response)', structuredResponse: null }];
              const renderedMessages = assistantMessages.map((msg, index) => ({
                id: `a_${Date.now()}_${index}`,
                isUser: false,
                content: msg.text,
              }));
              const lastText =
                assistantMessages[assistantMessages.length - 1]?.text || '';

              set((state) => ({
                currentMessageId: null,
                currentMessageText: lastText,
                hasReceivedAudio: false,
                isProcessing: false,
                messages: [...state.messages, ...renderedMessages],
                sessionId: result.sessionId || state.sessionId,
              }));

              if (get().volume > 0 && lastText) {
                for (const msg of assistantMessages) {
                  const ttsResult = await sendPreviewBridgeRequest<
                    { body: Record<string, unknown> },
                    PreviewTtsResult
                  >('alias-preview:ttsRequest', 'alias-preview:ttsResult', {
                    body: {
                      text: msg.text,
                      voice: agent?.voiceID || 'echo',
                      model: 'gpt-4o-mini-tts',
                      instructions:
                        voiceInstructionsStringHelper(
                          agent?.voiceInstructions
                        ) || 'Speak in a neutral tone.',
                      speed: agent?.voiceSpeed || 1.15,
                    },
                  });

                  if (ttsResult.audioBase64) {
                    set((state) => ({
                      audioQueue: [...state.audioQueue, ttsResult.audioBase64!],
                    }));
                    get().playNextAudio();
                  }
                }
              } else if (lastText) {
                window.setTimeout(
                  () => {
                    set({ currentMessageText: '' });
                  },
                  Math.max(lastText.length * 50, 2000)
                );
              }
            } catch (error) {
              console.error('[SocketChatPreview] sendMessage failed:', error);
              set((state) => ({
                isProcessing: false,
                messages: [
                  ...state.messages,
                  {
                    id: `e_${Date.now()}`,
                    isUser: false,
                    content: 'Sorry, something went wrong.',
                  },
                ],
              }));
            }
          })();

          return;
        }

        const sock = get().socket;

        // Get user's local time
        const _userLocalTime = new Date().toLocaleString();

        // Create message with timestamp appended (hidden from UI)
        // const messageWithTimestamp = `${content}. The user time of sending this message is ${userLocalTime}`;
        const messageWithTimestamp = `${content}.`;

        const newMessage = {
          id: generateUUID(),
          isUser: true,
          content, // Keep original content for UI display
        };

        const newMessages = [...get().messages, newMessage];
        set({
          messages: newMessages,
        });

        const { agent } = useAgentStore.getState();
        const resEngineDefaultName =
          process?.env?.NEXT_PUBLIC_DEFAULT_RESOURCE_ENGINE;
        if (sock && sock.readyState === WebSocket.OPEN) {
          set({ isProcessing: true });
          sock.send(
            JSON.stringify({
              type: 'send_message',
              session_id: get().sessionId,
              user_id: get().userId,
              message: messageWithTimestamp, // Send message with timestamp to server
              tts_provider: 'openai',
              instructions: voiceInstructionsStringHelper(
                agent?.voiceInstructions
              ),
              isMuted: get().volume === 0,
              engine_resource:
                agent?.adkDeploymentResourceName || resEngineDefaultName,
              voice: agent?.voiceID,
              voice_speed: agent?.voiceSpeed || 1.15,
              per_user_rpm:
                agent?.defaults?.messagesPerMinutePerUser || undefined,
              engine_rpm:
                agent?.defaults?.overallMessagesPerMinute || undefined,
              max_tokens_per_msg:
                agent?.defaults?.maximumTokensPerMessage || undefined,
            })
          );
        } else {
          // Try to connect first, then send the message
          get().connect(false);
          // Queue this message to be sent after connection is established
          setTimeout(() => {
            const newSock = get().socket;
            if (newSock && newSock.readyState === WebSocket.OPEN) {
              set({ isProcessing: true });
              const locale = navigator.language;
              newSock.send(
                JSON.stringify({
                  type: 'send_message',
                  session_id: get().sessionId,
                  user_id: get().userId,
                  message:
                    messageWithTimestamp +
                    ` User has preferred language ${locale}. Reply in that language.`,
                  tts_provider: 'openai',
                  isMuted: get().volume === 0,
                  per_user_rpm:
                    agent?.defaults?.messagesPerMinutePerUser || undefined,
                  engine_rpm:
                    agent?.defaults?.overallMessagesPerMinute || undefined,
                  max_tokens_per_msg:
                    agent?.defaults?.maximumTokensPerMessage || undefined,
                  instructions: voiceInstructionsStringHelper(
                    agent?.voiceInstructions
                  ),
                  engine_resource:
                    agent?.adkDeploymentResourceName || resEngineDefaultName,
                  voice: agent.voiceID,
                  voice_speed: agent?.voiceSpeed || 1.15,
                })
              );
            }
          }, 1000);
        }
      },

      playNextAudio: () => {
        const state = get();
        const { audioQueue, isPlayingAudio } = state;
        const playNextAudio = state.playNextAudio;
        if (isPlayingAudio || audioQueue.length === 0) {
          return;
        }

        set({ isPlayingAudio: true });

        // Mark as playing and get the next audio chunk
        const nextAudioChunk = audioQueue[0];
        let audioBuffer: ArrayBuffer;
        try {
          audioBuffer = decodeBase64ToArrayBuffer(nextAudioChunk);
        } catch (error) {
          console.error('[SocketChat] Bad audio chunk, dropping:', error);
          set((s) => ({
            audioQueue: s.audioQueue.slice(1),
            isPlayingAudio: false,
          }));
          setTimeout(() => playNextAudio(), 0);
          return;
        }

        const { currentVRM } = useVRMStore.getState();
        if (currentVRM?.model) {
          // Check if we have an emotion for this audio
          const { currentEmotion } = get();
          const emotion = currentEmotion || 'neutral';
          // 🔧 FIX: Only start animation on FIRST chunk
          const isFirstChunk = !get().hasReceivedAudio; // Use existing flag

          if (isFirstChunk) {
            set({ hasReceivedAudio: true }); // Mark that we've started
            useVRMStore.getState().handleAudioStart(emotion);
          }

          // 🔧 FIX: Use a flag to prevent double callback execution
          // Capture generation to detect if audio was interrupted
          const currentGeneration = audioGeneration;
          let speechEndCalled = false;

          currentVRM.model.onSpeechEnd = () => {
            // Skip if audio was interrupted (generation changed)
            if (audioGeneration !== currentGeneration) {
              return;
            }
            // Prevent double execution
            if (speechEndCalled) {
              return;
            }
            speechEndCalled = true;
            // Remove the played chunk
            const newQueue = [...get().audioQueue];
            newQueue.shift();

            set({
              audioQueue: newQueue,
              isPlayingAudio: false,
            });

            // 🔧 FIX: Only end animation when ALL audio is done
            if (newQueue.length === 0) {
              useVRMStore.getState().handleAudioEnd();
              set({ currentEmotion: null, hasReceivedAudio: false }); // Reset flag
            } else {
              // Small delay to prevent rapid switching
              setTimeout(() => playNextAudio(), 50);
            }
          };

          currentVRM.model
            .speakFromBuffer(audioBuffer)
            .then(() => {})
            .catch((err) => {
              console.error('[SocketChat] VRM speech error:', err);
              set({ isPlayingAudio: false });
              setTimeout(() => playNextAudio(), 0);
            });
          // ✅ Removed finally block - queue management now handled in onSpeechEnd callback
        } else {
          // No VRM model - use direct audio playback for visualizer mode
          const { volume } = get();
          get()
            .playAudioDirectly(audioBuffer, volume)
            .catch((err) => {
              console.error('[SocketChat] Direct audio playback error:', err);
              // Remove failed chunk and try next
              set((s) => ({
                audioQueue: s.audioQueue.slice(1),
                isPlayingAudio: false,
              }));
              setTimeout(() => playNextAudio(), 0);
            });
        }
      },

      setIsProcessing: (isProcessing: boolean) => {
        set({ isProcessing });
      },

      playAudioDirectly: async (audioBuffer: ArrayBuffer, volume = 1) => {
        const currentGeneration = audioGeneration;

        await playAudioDirectlyService({
          audioBuffer,
          volume,
          generation: currentGeneration,
          isCurrentGeneration: (generation) => audioGeneration === generation,
          onAudioNodes: ({ analyser, gainNode }) => {
            set({
              visualizerAnalyser: analyser,
              visualizerGainNode: gainNode,
            });
          },
          onComplete: () => {
            set((s) => ({
              audioQueue: s.audioQueue.slice(1),
              isPlayingAudio: false,
            }));
            setTimeout(() => get().playNextAudio(), 0);
          },
          onError: (error) => {
            console.error('[SocketChat] Direct audio playback error:', error);
            set((s) => ({
              audioQueue: s.audioQueue.slice(1),
              isPlayingAudio: false,
            }));
            setTimeout(() => get().playNextAudio(), 0);
          },
        });
      },

      interruptSpeech: () => {
        // Increment generation first to invalidate any pending audio callbacks
        audioGeneration++;

        // Disconnect visualizer audio to stop sound immediately
        const { visualizerGainNode } = get();
        if (visualizerGainNode) {
          try {
            visualizerGainNode.disconnect();
          } catch {
            // Already disconnected, ignore
          }
        }

        set({
          audioQueue: [],
          isPlayingAudio: false,
          currentMessageId: null,
          currentMessageText: '',
          hasReceivedAudio: false,
          visualizerAnalyser: null,
          visualizerGainNode: null,
        });

        audioBuffer = null;
        _textContent = '';

        const { currentVRM } = useVRMStore.getState();
        if (currentVRM?.model) {
          const wasSyntheticActive = get().syntheticSpeechActive;

          set({
            syntheticSpeechActive: false,
          });

          currentVRM.model.stopSpeaking();

          if (wasSyntheticActive) {
            // Clear the end-of-synthetic callback so the model's auto-end
            // timer does not fire a stale handleAudioEnd after the interrupt.
            currentVRM.model.onSyntheticSpeechEnd = undefined;
            currentVRM.model.stopSyntheticSpeech();
          }

          // Transition animations gracefully via controller
          useVRMStore.getState().handleAudioEnd();
        }
      },

      stopAgent: () => {
        const sock = get().socket;
        if (sock && sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'stop' }));
        }
        get().interruptSpeech();
        set({ isProcessing: false });
      },

      setVolume: (volume: number) => {
        set({ volume });

        // Update VRM model volume if available
        const { currentVRM } = useVRMStore.getState();
        if (currentVRM?.model) {
          currentVRM.model.setVolume(volume);
        }

        // Update visualizer gain node if available
        const { visualizerGainNode } = get();
        if (visualizerGainNode) {
          visualizerGainNode.gain.value = volume;

          // Reconnect/disconnect to audio destination based on volume
          const audioContext = visualizerGainNode.context;
          if (volume > 0) {
            // Connect to destination if not already connected
            try {
              visualizerGainNode.connect(audioContext.destination);
            } catch {
              // Already connected, ignore error
            }
          } else {
            // Disconnect from destination when muted
            try {
              visualizerGainNode.disconnect(audioContext.destination);
            } catch {
              // Not connected, ignore error
            }
          }
        }
      },
    }),
    {
      name: 'socket-chat-storage',
      // Persist preferences only; chat transcript/session state is per page load.
      partialize: (state) => ({
        userId: state.userId,
        volume: state.volume,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<SocketChatState>;
        return {
          ...currentState,
          userId: persisted.userId ?? currentState.userId,
          volume:
            typeof persisted.volume === 'number'
              ? persisted.volume
              : currentState.volume,
          messages: [],
          sessionId: undefined,
        };
      },
    }
  )
);

export default useSocketChatStore;

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Vector3 } from 'three';

import { ChatHeader } from '@/components/agent/ChatHeader';
import { ChatMessageList } from '@/components/agent/ChatMessageList';
import { PinnedMessageBanner } from '@/components/chat';
import Avatar2D from '@/components/common/2DAgent/avatar-2d';
import AudioVisualizer6 from '@/components/common/audio-visualizer-6';
import { VrmErrorBoundary } from '@/components/common/error-boundaries';
import TextareaWithButton from '@/components/common/textarea-with-button';
import VrmComponent from '@/components/vrm/VrmComponent';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useDeviceInfo } from '@/hooks/useDeviceInfo';
import { useTheme } from '@/hooks/useTheme';
import { sendGAEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import useBackgroundStore from '@/store/backgroundStore';
import useAgentStore from '@/store/useAgentStore';
import useSocketChatStore from '@/store/useSocketChatStore';
import useVRMStore from '@/store/vrmStore';
import { IAgent, PinnedMessageSeverity, VRMDisplayEnums } from '@/types/agent';

const MainCanvas = dynamic(
  () => import('@/components/canvas').then((mod) => mod.MainCanvas),
  { ssr: false }
);

type AvatarDisplayFlags = {
  shouldShowVRM: boolean;
  shouldShowVisualizer: boolean;
  shouldShow2DAvatar: boolean;
  shouldShowBanner: boolean;
};

type AvatarSectionProps = AvatarDisplayFlags & {
  agent: IAgent | null;
  agentAnalyser: AnalyserNode | null;
  avatarBackgroundStyle: React.CSSProperties;
  containerRef: React.RefObject<HTMLDivElement>;
  isBannerVisible: boolean;
  isDark: boolean;
  isInCall: boolean;
  isSimChatActive: boolean;
  volume: number;
  vrmLoadingState: { isLoading: boolean; progress: number };
};

const AvatarSection = React.memo(function AvatarSection({
  agent,
  agentAnalyser,
  avatarBackgroundStyle,
  containerRef,
  isBannerVisible,
  isDark,
  isInCall,
  isSimChatActive,
  shouldShow2DAvatar,
  shouldShowBanner,
  shouldShowVRM,
  shouldShowVisualizer,
  volume,
  vrmLoadingState,
}: AvatarSectionProps) {
  return (
    <>
      <AnimatePresence initial={false}>
        {shouldShowVRM && !isInCall && (
          <motion.div
            key="vrm-avatar"
            ref={containerRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={cn(
              'relative h-[210px] border-[0.4px] border-white  bg-background rounded-[10px]  mt-3',
              isDark && 'bg-black/80 border-white/10 ',
              isBannerVisible && 'mt-0'
            )}>
            {vrmLoadingState.isLoading && (
              <div className="flex items-center justify-center h-[210px]  w-full  ">
                <Loader2 size={24} className="text-foreground animate-spin" />
              </div>
            )}

            <div className="w-full  h-[210px]  overflow-hidden relative mx-auto ">
              <div className="absolute inset-0 z-20">
                <VrmErrorBoundary>
                  <MainCanvas
                    zOffset={0.6}
                    yOffset={-0.1}
                    xOffset={0}
                    xCamAndOrbitOffset={0}
                    yCamAndOrbitOffset={1.3}
                    zCamAndOrbitOffset={0.02}
                    className={cn(
                      vrmLoadingState.isLoading && 'w-0 h-0 opacity-0',
                      !vrmLoadingState.isLoading && 'w-full h-full'
                    )}>
                    <VrmComponent
                      defaultXYZ={null}
                      posOffset={new Vector3(0, 0, 0)}
                      volume={volume}
                    />
                  </MainCanvas>
                </VrmErrorBoundary>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {shouldShowVisualizer && !isInCall && (
          <motion.div
            key="visualizer-avatar"
            ref={containerRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={cn(
              'relative h-[210px] mt-3',
              isBannerVisible && 'mt-0'
            )}>
            <div className="w-full  h-[210px] rounded-xl overflow-hidden relative mx-auto">
              <div
                className="absolute inset-0 z-20 w-full h-full flex items-center justify-center"
                style={avatarBackgroundStyle}>
                <AudioVisualizer6
                  analyser={agentAnalyser}
                  audioSensitivity={2}
                  audioReactivity={1}
                  resolution={32}
                  distortion={1}
                  isDark={isDark}
                  volume={volume}
                  className="w-full h-full max-w-[200px] max-h-[200px]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {shouldShow2DAvatar && !isInCall && (
          <motion.div
            key="2d-avatar"
            ref={containerRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={cn(
              'relative h-[210px] mt-3 mb-2 ',
              isBannerVisible && 'mt-0'
            )}>
            <div className="w-full  h-[210px] rounded-xl overflow-hidden relative mx-auto">
              <div
                className="absolute inset-0 z-20 w-full h-full flex items-center justify-center"
                style={avatarBackgroundStyle}>
                <Avatar2D
                  analyser={agentAnalyser}
                  volume={volume}
                  isSimChatActive={isSimChatActive}
                  className="w-1/2 h-full object-contain"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {shouldShowBanner && (
          <motion.div
            key="banner-avatar"
            ref={containerRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={cn(
              'relative h-[210px] mt-3',
              isBannerVisible && 'mt-0'
            )}>
            <div className="w-full  h-[210px] rounded-xl overflow-hidden relative mx-auto">
              <img
                alt={agent?.defaults?.pageTitle}
                src={agent?.defaults?.bannerURL}
                className={cn(
                  'h-full rounded-[10px] aspect-cover object-cover w-full'
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default function AgentChat() {
  const {
    isProcessing: agentThinking,
    messages,
    connect,
    sendMessage,
    leaveStream,
    socket,
    userId,
    interruptSpeech,
    stopAgent,
    volume,
    setVolume,
    currentMessageText,
    isPlayingAudio,
    hasReceivedAudio,
  } = useSocketChatStore();
  const {
    loadingState: vrmLoadingState,
    isAvatarVisible,
    vrmDisplayMode,
    setVrmDisplayMode,
  } = useVRMStore();
  const currentBackground = useBackgroundStore(
    (state) => state.currentBackground
  );
  const { isDark } = useTheme();
  const agent = useAgentStore((state) => state.agent);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<
    number | undefined
  >();

  useLayoutEffect(() => {
    let animationFrameId: number | null = null;

    const updateContainerWidth = () => {
      if (containerRef.current) {
        const nextWidth = containerRef.current.offsetWidth;
        setContainerWidth((currentWidth) =>
          currentWidth === nextWidth ? currentWidth : nextWidth
        );
      }
    };

    const scheduleContainerWidthUpdate = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        updateContainerWidth();
      });
    };

    updateContainerWidth();

    const observedElement = containerRef.current;
    if (!observedElement) return undefined;

    const resizeObserver = new ResizeObserver(scheduleContainerWidthUpdate);
    resizeObserver.observe(observedElement);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, []);

  // Background style for 2D avatar / visualizer (same logic as VRM MainCanvas: Static, 360, Chroma)
  const avatarBackgroundStyle = React.useMemo(() => {
    if (!currentBackground) {
      return {
        backgroundImage: 'url(/img/bg.webp)',
        backgroundSize: 'cover' as const,
        backgroundPosition: 'center' as const,
      };
    }
    if (currentBackground.bgConfig?.type === 'Chroma') {
      return {
        backgroundColor: currentBackground.bgConfig?.color || '#0f0',
        backgroundImage: 'none',
      };
    }
    // Static or 360: use image (360 image shown as static in 2D context)
    const imageUrl = currentBackground.image?.url;
    if (imageUrl) {
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover' as const,
        backgroundPosition: 'center' as const,
      };
    }
    return {
      backgroundImage: 'url(/img/bg.webp)',
      backgroundSize: 'cover' as const,
      backgroundPosition: 'center' as const,
    };
  }, [currentBackground]);

  const [chatInputValue, setChatInputValue] = useState('');
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [agentAnalyser, setAgentAnalyser] = useState<AnalyserNode | null>(null);
  const [visualizerAnalyserVersion, setVisualizerAnalyserVersion] = useState(0);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSimChatActive, setIsSimChatActive] = useState(false);
  const { isMobileDevice, isInIframe } = useDeviceInfo();
  const [isMounted, setIsMounted] = useState(false);
  const simChatTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const simChatTextLengthRef = React.useRef(0);

  const handleCloseEmbeddedChat = () => {
    if (!isInIframe || !window.parent) return;

    const message = { type: 'close-chat' };
    window.parent.postMessage(message, '*');
    if (window.parent !== window.top) {
      window.top?.postMessage(message, '*');
    }
  };

  // Initialize VRM display mode from agent defaults
  useEffect(() => {
    if (agent?.defaults?.vrmDisplay) {
      setVrmDisplayMode(agent.defaults.vrmDisplay);
    }
  }, [agent?.defaults?.vrmDisplay, setVrmDisplayMode]);

  // Set volume to 0 (muted) when vrmDisplayMode is NONE
  useEffect(() => {
    if (vrmDisplayMode === VRMDisplayEnums.NONE) {
      setVolume(0);
    }
  }, [vrmDisplayMode, setVolume]);

  // Force volume to 0 when the agent's CMS "Enable Sound Button" flag is
  // disabled. This routes the CMS toggle through the same `volume === 0`
  // gate that the Mute button uses, so the synthetic-speech path activates
  // without the agent owner / user needing to touch the UI mute control.
  // (CMS changes only take effect on page load — see
  //  `agent.defaults.enableVoiceButton`.)
  useEffect(() => {
    if (agent?.defaults?.enableVoiceButton === false) {
      setVolume(0);
    }
  }, [agent?.defaults?.enableVoiceButton, setVolume]);

  // Mark as mounted after first render so avatar sections skip the initial
  // flash caused by the store defaulting to VRM mode before agent data loads.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Determine what to actually render
  const {
    shouldShowVRM,
    shouldShowVisualizer,
    shouldShow2DAvatar,
    shouldShowBanner,
    noAvatarMode,
  } = React.useMemo(
    () => ({
      shouldShowVRM:
        isMounted && vrmDisplayMode === VRMDisplayEnums.VRM && isAvatarVisible,
      shouldShowVisualizer:
        isMounted &&
        vrmDisplayMode === VRMDisplayEnums.VISUALIZER &&
        isAvatarVisible,
      shouldShow2DAvatar:
        isMounted &&
        vrmDisplayMode === VRMDisplayEnums.TWO_DIMENSIONAL &&
        isAvatarVisible,
      shouldShowBanner:
        isMounted &&
        vrmDisplayMode === VRMDisplayEnums.BANNER &&
        isAvatarVisible,
      noAvatarMode: vrmDisplayMode === VRMDisplayEnums.NONE,
    }),
    [isAvatarVisible, isMounted, vrmDisplayMode]
  );

  // Simulated chat: estimate speech duration from text length when no audio is available.
  // Text arrives and is cleared quickly on end_of_turn, so we capture the length and keep
  // the simulation running for an estimated duration (~50ms per char ≈ 150 WPM).
  useEffect(() => {
    const hasAudio = isPlayingAudio || hasReceivedAudio;

    // If audio becomes available, cancel simulation immediately
    if (hasAudio || agentAnalyser) {
      if (simChatTimeoutRef.current) {
        clearTimeout(simChatTimeoutRef.current);
        simChatTimeoutRef.current = null;
      }
      simChatTextLengthRef.current = 0;
      setIsSimChatActive(false);
      return;
    }

    // Agent has text and no audio → start simulated chat with duration estimate
    if (currentMessageText.length > 0 && !hasAudio && !agentAnalyser) {
      // Track the max text length seen for this response
      simChatTextLengthRef.current = Math.max(
        simChatTextLengthRef.current,
        currentMessageText.length
      );

      // Clear any existing timeout (will be re-set with updated duration)
      if (simChatTimeoutRef.current) {
        clearTimeout(simChatTimeoutRef.current);
      }

      // Estimate speech duration: ~50ms per character (roughly 150 WPM)
      const estimatedMs = Math.max(
        simChatTextLengthRef.current * 50,
        2000 // Minimum 2 seconds
      );

      console.log(
        `[AgentChat] SimChat: ${simChatTextLengthRef.current} chars → estimated ${(estimatedMs / 1000).toFixed(1)}s`
      );

      setIsSimChatActive(true);

      simChatTimeoutRef.current = setTimeout(() => {
        console.log(
          '[AgentChat] SimChat: estimated duration elapsed, stopping'
        );
        setIsSimChatActive(false);
        simChatTimeoutRef.current = null;
        simChatTextLengthRef.current = 0;
      }, estimatedMs);
    }
  }, [currentMessageText, isPlayingAudio, hasReceivedAudio, agentAnalyser]);

  // Cleanup sim chat timeout on unmount
  useEffect(() => {
    return () => {
      if (simChatTimeoutRef.current) {
        clearTimeout(simChatTimeoutRef.current);
      }
    };
  }, []);

  const {
    isRecording: recording,
    startRecording,
    stopRecording,
    isProcessing,
  } = useAudioRecording({
    onTranscriptionComplete: (text) => {
      if (isInCall) {
        // In call mode, send the transcribed text automatically
        if (text.trim()) {
          sendMessage(text);
          if (userId) {
            sendGAEvent('event', 'message_sent', {
              user_id: userId,
              time_in_utc: new Date().toISOString(),
              message: text,
            });
          }
        }
      } else {
        // In chat mode, set the input value
        setChatInputValue(text);
      }
    },
    onNoAudioDetected: () => {
      console.log('No meaningful audio detected, closing mic modal');
    },
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { currentVRM, setAvatarVisibility } = useVRMStore();

  let initializeOnce = false;

  // Monitor visualizer analyser changes (used by both VISUALIZER and 2D avatar for lip sync)
  useEffect(() => {
    if (
      vrmDisplayMode === VRMDisplayEnums.VISUALIZER ||
      vrmDisplayMode === VRMDisplayEnums.TWO_DIMENSIONAL
    ) {
      const unsubscribe = useSocketChatStore.subscribe((state) => {
        if (state.visualizerAnalyser) {
          setVisualizerAnalyserVersion((prev) => prev + 1);
        }
      });
      return unsubscribe;
    }
  }, [vrmDisplayMode]);

  // Monitor agent's audio for visualization
  useEffect(() => {
    // In visualizer mode, use the visualizer analyser
    if (vrmDisplayMode === VRMDisplayEnums.VISUALIZER) {
      const { visualizerAnalyser } = useSocketChatStore.getState();

      if (!visualizerAnalyser) {
        console.log('[AgentChat] No visualizer analyser available');
        setAgentAnalyser(null);
        return;
      }

      setAgentAnalyser(visualizerAnalyser);
      const frequencyData = new Uint8Array(
        visualizerAnalyser.frequencyBinCount
      );
      console.log(
        '[AgentChat] Starting visualizer audio monitoring with',
        frequencyData.length,
        'frequency bins'
      );

      let frameCount = 0;
      const updateAgentAudio = () => {
        visualizerAnalyser.getByteFrequencyData(frequencyData);

        // Convert to Float32Array and normalize to 0-1 range
        const normalizedData = new Float32Array(frequencyData.length);
        let hasData = false;
        let maxValue = 0;
        for (let i = 0; i < frequencyData.length; i++) {
          normalizedData[i] = frequencyData[i] / 255;
          if (frequencyData[i] > 0) hasData = true;
          maxValue = Math.max(maxValue, frequencyData[i]);
        }

        // Log every 60 frames (about once per second at 60fps)
        if (frameCount % 60 === 0) {
          console.log(
            '[AgentChat] Visualizer audio monitoring - hasData:',
            hasData,
            'maxValue:',
            maxValue
          );
        }
        frameCount++;

        requestAnimationFrame(updateAgentAudio);
      };

      updateAgentAudio();

      return () => {
        console.log('[AgentChat] Stopping visualizer audio monitoring');
        setAgentAnalyser(null);
      };
    }

    // In 2D avatar mode, use the visualizer analyser (TTS audio) for lip sync
    if (vrmDisplayMode === VRMDisplayEnums.TWO_DIMENSIONAL) {
      const { visualizerAnalyser } = useSocketChatStore.getState();

      if (!visualizerAnalyser) {
        setAgentAnalyser(null);
        return;
      }

      setAgentAnalyser(visualizerAnalyser);

      return () => {
        setAgentAnalyser(null);
      };
    }

    // In VRM mode, use the VRM model's analyser
    if (!currentVRM?.model) {
      console.log('[AgentChat] No VRM model available');
      return;
    }

    const analyser = currentVRM.model.getLipSyncAnalyser();
    const isSpeaking = currentVRM.model.isAgentSpeaking();
    console.log(
      '[AgentChat] Audio monitoring - analyser available:',
      !!analyser,
      'isSpeaking:',
      isSpeaking
    );

    if (!analyser) {
      console.log('[AgentChat] No analyser available, clearing audio data');
      setAgentAnalyser(null);
      return;
    }

    setAgentAnalyser(analyser);

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    console.log(
      '[AgentChat] Starting audio monitoring with',
      frequencyData.length,
      'frequency bins'
    );

    let frameCount = 0;
    const updateAgentAudio = () => {
      analyser.getByteFrequencyData(frequencyData);

      // Convert to Float32Array and normalize to 0-1 range
      const normalizedData = new Float32Array(frequencyData.length);
      let hasData = false;
      let maxValue = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        normalizedData[i] = frequencyData[i] / 255;
        if (frequencyData[i] > 0) hasData = true;
        maxValue = Math.max(maxValue, frequencyData[i]);
      }

      // Log every 60 frames (about once per second at 60fps)
      if (frameCount % 60 === 0) {
        console.log(
          '[AgentChat] Audio monitoring - hasData:',
          hasData,
          'maxValue:',
          maxValue,
          'isSpeaking:',
          currentVRM.model.isAgentSpeaking()
        );
      }
      frameCount++;

      requestAnimationFrame(updateAgentAudio);
    };

    updateAgentAudio();

    return () => {
      console.log('[AgentChat] Stopping audio monitoring');
      setAgentAnalyser(null);
    };
  }, [currentVRM?.model, vrmDisplayMode, visualizerAnalyserVersion]);

  // Initialize socket connection when component mounts (after user interaction)
  useEffect(() => {
    // Only initialize if socket doesn't exist yet
    if (!socket) {
      console.log('Initializing socket connection after user interaction');
      connect();
      if (!initializeOnce) {
        initializeOnce = true;
        // Send event
        sendGAEvent('event', 'session_connect', {
          user_id: userId,
          time_in_utc: new Date().toISOString(),
        });
      }
    }

    // Setup a periodic check to ensure socket is connected
    const connectionCheck = setInterval(() => {
      const currentSocket = useSocketChatStore.getState().socket;
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
        console.log('Socket connection check: reconnecting...');
        connect();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(connectionCheck);
    };
  }, [connect, socket]);

  useEffect(() => {
    return () => {
      console.log('Cleaning up AgentChat component');
      leaveStream();
      // We don't call disconnect() here anymore to maintain connection
      // between page navigations
    };
  }, [leaveStream]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        const container = chatContainerRef.current;
        const scrollHeight = container.scrollHeight;
        const height = container.clientHeight;
        const maxScrollTop = scrollHeight - height;

        container.scrollTo({
          top: maxScrollTop,
          behavior: 'smooth',
        });
      }
    };

    // Scroll immediately and then again after a small delay to ensure content is loaded
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [messages]);

  const handleSend = (text?: string) => {
    const messageText = text || chatInputValue;
    if (!messageText.trim()) return;

    interruptSpeech();

    sendMessage(messageText);
    // Send event
    if (userId)
      sendGAEvent('event', 'message_sent', {
        user_id: userId,
        time_in_utc: new Date().toISOString(),
        message: messageText,
      });
    setChatInputValue('');
  };

  const handleVolumeChange = (newVolume: number) => {
    const previousVolume = volume;
    setVolume(newVolume);

    // Track analytics when volume is muted (set to 0)
    if (previousVolume > 0 && newVolume === 0 && userId) {
      sendGAEvent('event', 'volume_muted', {
        user_id: userId,
        time_in_utc: new Date().toISOString(),
        previous_volume: previousVolume,
        new_volume: newVolume,
      });
    }
  };

  const handleMicClick = async () => {
    if (recording) {
      await stopRecording();
    } else {
      // Track analytics when user starts recording
      if (userId) {
        sendGAEvent('event', 'mic_recording_started', {
          user_id: userId,
          time_in_utc: new Date().toISOString(),
        });
      }
      await startRecording();
    }
  };

  const handleCallClick = () => {
    setIsInCall(true);
  };

  const _handleEndCall = () => {
    setIsInCall(false);
  };

  const _handleToggleMic = async () => {
    if (isInCall) {
      // In call mode, handle recording
      if (recording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    } else {
      // In chat mode, just toggle mute state
      setIsMicMuted(!isMicMuted);
    }
  };

  const handleCopyURL = () => {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast('Link copied.');
      })
      .catch((err) => {
        toast('Failed to copy link: ' + err.message);
      });
  };

  const isBannerVisible =
    !!agent?.defaults?.pinnedMessage && !isBannerDismissed;

  return (
    <div className="w-full h-dvh flex flex-col items-center relative">
      <div className="flex-1 min-h-0 w-full flex flex-col items-center md:justify-center ">
        <div
          className={cn(
            'relative md:max-h-[90dvh] 2xl:max-h-[800px] h-full flex flex-col flex-1 md:max-w-md 2xl:max-w-lg w-full bg-[#F5F5F5]/75 backdrop-blur-[7px] md:rounded-xl border-[0.4px] border-white overflow-x-hidden ios-keyboard-fix z-50 p-[18px] shadow-[4px_8px_50px_0px_#00000040]',
            isDark && 'bg-black/80 border-white/10 ',
            (isOpen || isMapOpen) && 'backdrop-blur-none border-none'
          )}>
          {(isOpen || isMapOpen) && (
            <div
              className={cn(
                'absolute top-0 left-0 w-full h-full pointer-events-none z-[55] bg-black/10 backdrop-blur-[35px] shadow-[4px_8px_50px_0px_#00000015]',
                isDark && 'bg-white/10'
              )}
              onAbort={() => {
                setIsOpen(false);
                setIsMapOpen(false);
              }}
            />
          )}

          <div
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
            style={{ pointerEvents: 'none', touchAction: 'none' }}
          />

          {/* Logo + menu header */}
          <ChatHeader
            agent={agent}
            isDark={isDark}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            isMapOpen={isMapOpen}
            setIsMapOpen={setIsMapOpen}
            containerWidth={containerWidth}
            isInIframe={isInIframe}
            isMobileDevice={isMobileDevice}
            onCopyURL={handleCopyURL}
            onCloseEmbeddedChat={handleCloseEmbeddedChat}
          />

          {isBannerVisible && (
            <div className="mt-3">
              <PinnedMessageBanner
                message={agent.defaults.pinnedMessage.toString()}
                severity={
                  agent.defaults.pinnedMessageSeverity ||
                  PinnedMessageSeverity.INFO
                }
                isDark={isDark}
                onClose={() => setIsBannerDismissed(true)}
              />
            </div>
          )}

          <AvatarSection
            agent={agent}
            agentAnalyser={agentAnalyser}
            avatarBackgroundStyle={avatarBackgroundStyle}
            containerRef={containerRef}
            isBannerVisible={isBannerVisible}
            isDark={isDark}
            isInCall={isInCall}
            isSimChatActive={isSimChatActive}
            shouldShow2DAvatar={shouldShow2DAvatar}
            shouldShowBanner={shouldShowBanner}
            shouldShowVRM={shouldShowVRM}
            shouldShowVisualizer={shouldShowVisualizer}
            volume={volume}
            vrmLoadingState={vrmLoadingState}
          />

          <AnimatePresence initial={false}>
            {!isTermsAccepted && (
              <motion.div
                key="ai-terms"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'pointer-events-auto mx-auto inline-flex items-center gap-2 text-xs leading-snug text-[#6F6F6F]  p-1.5 ',
                  noAvatarMode ? 'mt-[40%]' : ''
                )}>
                <span>
                  By chatting, you agree to our{' '}
                  <Link
                    href="https://alias.cm/ai-terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'text-black font-semibold hover:text-alias underline',
                      isDark && 'text-white'
                    )}>
                    AI Terms
                  </Link>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <ChatMessageList
            messages={messages}
            isThinking={agentThinking}
            isDark={isDark}
            scrollRef={chatContainerRef}
          />

          <div className="shrink-0 z-50 mt-[10px]">
            <div className="w-full">
              <TextareaWithButton
                placeholder="What do you want to ask?"
                containerClassName={cn(
                  'w-full bg-white/60',
                  isDark && 'bg-white/10'
                )}
                value={chatInputValue}
                onChange={(e) => {
                  setChatInputValue(e.target.value);
                  if (!isTermsAccepted) {
                    setIsTermsAccepted(true);
                    if (vrmDisplayMode === VRMDisplayEnums.BANNER) {
                      setAvatarVisibility(false);
                    }
                  }
                }}
                onSendClick={handleSend}
                onMicClick={handleMicClick}
                onCallClick={handleCallClick}
                onStopClick={stopAgent}
                isRecording={recording}
                isProcessing={isProcessing}
                disabled={agentThinking}
                isDark={isDark}
                hideAvatarButton={noAvatarMode}
                suggestedQueries={agent?.defaults?.defaultQuestionTexts}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                enableVoiceButton={agent?.defaults?.enableVoiceButton}
                accentColorHex={agent?.defaults?.accentColorHex}
                onSuggestionSelect={() => {
                  if (!isTermsAccepted) {
                    setIsTermsAccepted(true);
                    if (vrmDisplayMode === VRMDisplayEnums.BANNER) {
                      setAvatarVisibility(false);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

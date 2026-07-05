'use client';

import React, { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import PNGtuberAvatar, { PNGtuberAvatarHandle } from './pngtuber-avatar';

interface Avatar2DProps {
  className?: string;
  volume?: number;
  analyser?: AnalyserNode | null;
  /** When true, simulates mouth movement (for muted/text-only mode) */
  isSimChatActive?: boolean;
}

/**
 * 2D Avatar component using PNGtuber system.
 * Connects to audio analyser for lip sync and supports expression changes.
 */
export default function Avatar2D({
  className,
  volume,
  analyser,
  isSimChatActive = false,
}: Avatar2DProps) {
  const avatarRef = useRef<PNGtuberAvatarHandle>(null);
  const fxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lookDirectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(
    analyser || null
  );

  // Keep local analyser in sync with prop
  useEffect(() => {
    setActiveAnalyser((prev) => {
      if (prev !== analyser) {
        console.log('[Avatar2D] Analyser updated:', !!analyser);
        return analyser || null;
      }
      return prev;
    });
  }, [analyser]);

  // Listen for emotion events from agent responses
  useEffect(() => {
    const handleEmotion = (event: CustomEvent<{ emotion: string }>) => {
      const emotion = event.detail.emotion?.toLowerCase().trim();
      if (!emotion || !avatarRef.current) return;

      console.log('[Avatar2D] Received emotion:', emotion);

      // Clear any existing FX timeout
      if (fxTimeoutRef.current) {
        clearTimeout(fxTimeoutRef.current);
        fxTimeoutRef.current = null;
      }

      // Clear any existing look direction timeout
      if (lookDirectionTimeoutRef.current) {
        clearTimeout(lookDirectionTimeoutRef.current);
        lookDirectionTimeoutRef.current = null;
      }

      // Map emotion to 2D avatar expression and FX (matching VRM mapping for consistency)
      // Available expressions: neutral, happy, sad, angry, surprised, love
      // Available FX: blush, hearts, question, sparkle, sweat

      let expression:
        | 'neutral'
        | 'happy'
        | 'sad'
        | 'angry'
        | 'surprised'
        | 'love' = 'neutral';
      let fx: string | null = null;

      // Map emotions to match VRM mapping structure
      switch (emotion) {
        // Basic emotions - matching VRM mapping
        case 'happy':
        case 'joy':
          expression = 'happy';
          fx = 'hearts';
          break;
        case 'sad':
        case 'sorrow':
          expression = 'sad';
          fx = null;
          break;
        case 'angry':
          expression = 'angry';
          fx = 'sweat';
          break;
        case 'relaxed':
          // No relaxed eyebrow asset, map to neutral
          expression = 'neutral';
          fx = null;
          break;
        case 'neutral':
          expression = 'neutral';
          fx = null;
          break;

        // Eye movements - handle via look direction or eye state
        case 'blink':
          // Trigger a blink
          avatarRef.current.setEyeState('closed');
          setTimeout(() => {
            if (avatarRef.current) {
              avatarRef.current.setEyeState('open');
            }
          }, 150);
          return; // Early return, no expression change needed
        case 'blinkleft':
        case 'blinkright':
          // Single eye blinks not directly supported, use regular blink
          avatarRef.current.setEyeState('closed');
          setTimeout(() => {
            if (avatarRef.current) {
              avatarRef.current.setEyeState('open');
            }
          }, 150);
          return;
        case 'lookup':
          avatarRef.current.setLookDirection({ x: 0, y: -0.5 });
          // Reset look direction after 2 seconds
          lookDirectionTimeoutRef.current = setTimeout(() => {
            if (avatarRef.current) {
              avatarRef.current.setLookDirection({ x: 0, y: 0 });
            }
            lookDirectionTimeoutRef.current = null;
          }, 2000);
          return; // Early return, no expression change needed
        case 'lookdown':
          avatarRef.current.setLookDirection({ x: 0, y: 0.5 });
          lookDirectionTimeoutRef.current = setTimeout(() => {
            if (avatarRef.current) {
              avatarRef.current.setLookDirection({ x: 0, y: 0 });
            }
            lookDirectionTimeoutRef.current = null;
          }, 2000);
          return;
        case 'lookleft':
          avatarRef.current.setLookDirection({ x: -0.5, y: 0 });
          lookDirectionTimeoutRef.current = setTimeout(() => {
            if (avatarRef.current) {
              avatarRef.current.setLookDirection({ x: 0, y: 0 });
            }
            lookDirectionTimeoutRef.current = null;
          }, 2000);
          return;
        case 'lookright':
          avatarRef.current.setLookDirection({ x: 0.5, y: 0 });
          lookDirectionTimeoutRef.current = setTimeout(() => {
            if (avatarRef.current) {
              avatarRef.current.setLookDirection({ x: 0, y: 0 });
            }
            lookDirectionTimeoutRef.current = null;
          }, 2000);
          return;

        // Fallback for unmapped emotions (surprised, love, etc.)
        default:
          expression = 'neutral';
          fx = null;
          break;
      }

      avatarRef.current.setExpression(expression);
      avatarRef.current.setFx(fx);

      console.log('[Avatar2D] Set expression:', expression, 'FX:', fx);

      // Auto-clear FX after 3 seconds (FX effects are temporary)
      if (fx) {
        fxTimeoutRef.current = setTimeout(() => {
          if (avatarRef.current) {
            avatarRef.current.setFx(null);
            console.log('[Avatar2D] FX cleared after timeout');
          }
          fxTimeoutRef.current = null;
        }, 3000);
      }
    };

    window.addEventListener('avatar2d-emotion', handleEmotion as EventListener);

    return () => {
      window.removeEventListener(
        'avatar2d-emotion',
        handleEmotion as EventListener
      );
      if (fxTimeoutRef.current) {
        clearTimeout(fxTimeoutRef.current);
        fxTimeoutRef.current = null;
      }
      if (lookDirectionTimeoutRef.current) {
        clearTimeout(lookDirectionTimeoutRef.current);
        lookDirectionTimeoutRef.current = null;
      }
    };
  }, []);

  // Simulated chat: drive mouth movement when agent is responding but no audio is available
  // This mirrors the VRM avatar's behavior of keeping animations active during muted speech
  useEffect(() => {
    if (!isSimChatActive) {
      // Ensure mouth is closed when simulation stops
      if (avatarRef.current) {
        avatarRef.current.setMouthState('closed');
      }
      return;
    }

    console.log('[Avatar2D] Starting simulated chat mouth movement');

    const talkingMouthStates: ('small' | 'medium' | 'large')[] = [
      'small',
      'medium',
      'large',
    ];

    const intervalId = setInterval(() => {
      if (avatarRef.current) {
        const randomIndex = Math.floor(
          Math.random() * talkingMouthStates.length
        );
        avatarRef.current.setMouthState(talkingMouthStates[randomIndex]);
      }
    }, 120); // Match PNGtuber's existing lip sync update interval

    return () => {
      console.log('[Avatar2D] Stopping simulated chat mouth movement');
      clearInterval(intervalId);
      if (avatarRef.current) {
        avatarRef.current.setMouthState('closed');
      }
    };
  }, [isSimChatActive]);

  return (
    <div
      className={cn(
        'w-full h-full flex items-center justify-center',
        className
      )}>
      <PNGtuberAvatar
        ref={avatarRef}
        analyser={activeAnalyser}
        volume={volume}
        className="w-full h-full"
      />
    </div>
  );
}

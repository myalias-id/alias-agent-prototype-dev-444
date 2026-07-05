/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  ADAPTATION_RATE,
  HISTORY_WINDOW_SIZE,
  NOISE_FLOOR,
  RMS_WINDOW_SIZE,
} from '@/lib/audioConstants';

interface PNGtuberAvatarProps {
  className?: string;
  volume?: number;
  analyser?: AnalyserNode | null;
}

export interface PNGtuberAvatarHandle {
  setExpression: (
    expression: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'love'
  ) => void;
  setFx: (fx: string | null) => void;
  setMouthState: (state: 'closed' | 'small' | 'medium' | 'large') => void;
  setEyeState: (state: 'open' | 'closed' | 'half') => void;
  setLookDirection: (direction: { x: number; y: number }) => void;
  loadCustomAssets: (assetPaths: Record<string, any>) => Promise<void>;
}

const PNGtuberAvatar = forwardRef<PNGtuberAvatarHandle, PNGtuberAvatarProps>(
  ({ className, volume: _volume = 1, analyser }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);

    // Image/SVG layer refs
    const layerImagesRef = useRef<{
      hairBack: HTMLImageElement | null;
      body: HTMLImageElement | null;
      head: HTMLImageElement | null;
      eyebrows: Record<string, HTMLImageElement>;
      eyes: Record<string, HTMLImageElement>;
      mouths: Record<string, HTMLImageElement>;
      hairFront: HTMLImageElement | null;
      fx: Record<string, HTMLImageElement>;
    }>({
      hairBack: null,
      body: null,
      head: null,
      eyebrows: {},
      eyes: {},
      mouths: {},
      hairFront: null,
      fx: {},
    });

    const [currentExpression, setCurrentExpression] = useState<
      'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'love'
    >('neutral');
    const [currentFx, setCurrentFx] = useState<string | null>(null); // Current FX effect (hearts, sparkle, etc.)
    const [mouthState, setMouthState] = useState<
      'closed' | 'small' | 'medium' | 'large'
    >('closed');
    const [eyeState, setEyeState] = useState<'open' | 'closed' | 'half'>(
      'open'
    );
    const [_audioLevel, setAudioLevel] = useState(0);
    const [lookDirection, setLookDirection] = useState({ x: 0, y: 0 }); // -1 to 1 range
    const [_useCustomAssets, setUseCustomAssets] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState(false);

    // Blink timer
    const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
    const timeRef = useRef(0);

    // Floating motion state (water-like movement)
    const floatingStateRef = useRef({
      x: 0, // Current floating X position
      y: 0, // Current floating Y position
      rotation: 0, // Current rotation angle (radians)
      velocityX: 0, // Current velocity X
      velocityY: 0, // Current velocity Y
      velocityRotation: 0, // Current rotation velocity
      driftX: 0, // Drift offset X (water current)
      driftY: 0, // Drift offset Y (water current)
      driftTargetX: 0, // Target drift X
      driftTargetY: 0, // Target drift Y
      lastDriftUpdate: 0, // Last time drift target was updated
    });

    // Use refs to ensure drawAvatar always has current state values
    const mouthStateRef = useRef(mouthState);
    const eyeStateRef = useRef(eyeState);
    const expressionRef = useRef(currentExpression);
    const fxRef = useRef(currentFx);
    const lookDirectionRef = useRef(lookDirection);

    // Update refs when state changes
    useEffect(() => {
      mouthStateRef.current = mouthState;
    }, [mouthState]);

    useEffect(() => {
      eyeStateRef.current = eyeState;
    }, [eyeState]);

    useEffect(() => {
      expressionRef.current = currentExpression;
    }, [currentExpression]);

    useEffect(() => {
      fxRef.current = currentFx;
    }, [currentFx]);

    useEffect(() => {
      lookDirectionRef.current = lookDirection;
    }, [lookDirection]);

    // Load image or SVG
    const loadImageOrSVG = async (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        // Check if it's an SVG
        if (src.toLowerCase().endsWith('.svg')) {
          fetch(src)
            .then((res) => res.text())
            .then((svgText) => {
              const blob = new Blob([svgText], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
              };
              img.onerror = reject;
              img.src = url;
            })
            .catch(reject);
        } else {
          // Regular PNG/JPG
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        }
      });
    };

    // Load default assets from public/2D
    const loadDefaultAssets = async () => {
      try {
        console.log('[PNGtuberAvatar] Loading default assets from /2D/');
        const layers = layerImagesRef.current;

        // Load head
        layers.head = await loadImageOrSVG('/2D/Head.png');
        console.log('[PNGtuberAvatar] Loaded head');

        // Load eye states
        layers.eyes.open = await loadImageOrSVG('/2D/Eyes_Open.png');
        layers.eyes.closed = await loadImageOrSVG('/2D/Eyes_Closed.png');
        layers.eyes.half = await loadImageOrSVG('/2D/Eyes_Half.png');
        console.log('[PNGtuberAvatar] Loaded eyes');

        // Load mouth states
        layers.mouths.closed = await loadImageOrSVG('/2D/Mouth_Closed.png');
        layers.mouths.small = await loadImageOrSVG('/2D/Mouth_Small.png');
        layers.mouths.medium = await loadImageOrSVG('/2D/Mouth_Medium.png');
        layers.mouths.large = await loadImageOrSVG('/2D/Mouth_Large.png');
        console.log(
          '[PNGtuberAvatar] Loaded mouths:',
          Object.keys(layers.mouths)
        );

        // Load eyebrow states
        layers.eyebrows.neutral = await loadImageOrSVG('/2D/Brow_Neutral.png');
        layers.eyebrows.happy = await loadImageOrSVG('/2D/Brow_Happy.png');
        layers.eyebrows.sad = await loadImageOrSVG('/2D/Brow_Sad.png');
        layers.eyebrows.angry = await loadImageOrSVG('/2D/Brow_Angry.png');
        layers.eyebrows.surprised = await loadImageOrSVG(
          '/2D/Brow_Surprised.png'
        );
        layers.eyebrows.love = await loadImageOrSVG('/2D/Brow_Love.png');
        console.log('[PNGtuberAvatar] Loaded eyebrows');

        // Load FX effects
        layers.fx.blush = await loadImageOrSVG('/2D/Fx_Blush.png');
        layers.fx.hearts = await loadImageOrSVG('/2D/Fx_Hearts.png');
        layers.fx.question = await loadImageOrSVG('/2D/Fx_Question.png');
        layers.fx.sparkle = await loadImageOrSVG('/2D/Fx_Sparkle.png');
        layers.fx.sweat = await loadImageOrSVG('/2D/Fx_Sweat.png');
        console.log('[PNGtuberAvatar] Loaded FX effects');

        setImagesLoaded(true);
        setUseCustomAssets(true);
        console.log('[PNGtuberAvatar] All assets loaded successfully');
      } catch (error) {
        console.error('[PNGtuberAvatar] Error loading default assets:', error);
        setUseCustomAssets(false);
      }
    };

    // Load custom assets (public API)
    const loadCustomAssets = async (assetPaths: Record<string, any>) => {
      try {
        const layers = layerImagesRef.current;

        // Load hair back
        if (assetPaths.hairBack) {
          layers.hairBack = await loadImageOrSVG(assetPaths.hairBack);
        }

        // Load body and head
        if (assetPaths.body) {
          layers.body = await loadImageOrSVG(assetPaths.body);
        }
        if (assetPaths.head) {
          layers.head = await loadImageOrSVG(assetPaths.head);
        }

        // Load eye states
        if (assetPaths.eyes) {
          for (const [state, path] of Object.entries(assetPaths.eyes)) {
            layers.eyes[state] = await loadImageOrSVG(path as string);
          }
        }

        // Load mouth states
        if (assetPaths.mouths) {
          for (const [state, path] of Object.entries(assetPaths.mouths)) {
            layers.mouths[state] = await loadImageOrSVG(path as string);
          }
        }

        // Load eyebrow states
        if (assetPaths.eyebrows) {
          for (const [state, path] of Object.entries(assetPaths.eyebrows)) {
            layers.eyebrows[state] = await loadImageOrSVG(path as string);
          }
        }

        // Load hair front
        if (assetPaths.hairFront) {
          layers.hairFront = await loadImageOrSVG(assetPaths.hairFront);
        }

        setImagesLoaded(true);
        setUseCustomAssets(true);
      } catch (error) {
        console.error('Error loading custom assets:', error);
        setUseCustomAssets(false);
      }
    };

    // Expose public API
    useImperativeHandle(ref, () => ({
      setExpression: (expression) => setCurrentExpression(expression),
      setFx: (fx) => setCurrentFx(fx),
      setMouthState: (state) => setMouthState(state),
      setEyeState: (state) => setEyeState(state),
      setLookDirection: (direction) => setLookDirection(direction),
      loadCustomAssets,
    }));

    const drawAvatar = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, 500, 500);

      const centerX = 250;
      const centerY = 250;

      // Check if talking (mouth is not closed)
      const isTalking = mouthStateRef.current !== 'closed';
      const floating = floatingStateRef.current;

      // Water-like motion constants (higher damping while talking)
      const waterDamping = isTalking ? 0.92 : 0.88; // Extra damping while talking
      const waterLerpFactor = isTalking ? 0.015 : 0.02; // Slower interpolation while talking
      const centerPull = 0.015; // Constant pull back to center

      // Update drift target periodically (water current)
      const driftUpdateInterval = 4000; // Change drift every 4 seconds
      if (time - floating.lastDriftUpdate >= driftUpdateInterval) {
        // Random drift target (like water current) - more vertical drift
        const maxDriftX = isTalking ? 15 : 25; // Less horizontal drift while talking
        const maxDriftY = isTalking ? 25 : 35; // More vertical drift
        floating.driftTargetX = (Math.random() - 0.5) * maxDriftX * 2;
        floating.driftTargetY = (Math.random() - 0.5) * maxDriftY * 2;
        floating.lastDriftUpdate = time;
      }

      // Add vertical sine wave to drift Y for continuous up/down motion
      const verticalDriftWave = Math.sin(time * 0.0004) * 12; // Vertical drift wave
      floating.driftTargetY += verticalDriftWave * 0.01; // Add to target gradually

      // Drift motion (water current) - always pulls back to center
      floating.driftTargetX += (0 - floating.driftTargetX) * centerPull;
      floating.driftTargetY += (0 - floating.driftTargetY) * centerPull;

      // Smooth drift interpolation (slower while talking)
      const driftLerpFactor = isTalking ? 0.015 : 0.02;
      floating.driftX +=
        (floating.driftTargetX - floating.driftX) * driftLerpFactor;
      floating.driftY +=
        (floating.driftTargetY - floating.driftY) * driftLerpFactor;

      // Local floating motion (gentle bobbing)
      if (isTalking) {
        // Gentle circular motion while talking with more vertical movement
        const angle = time * 0.00015; // Slower rotation while talking
        const radiusX = 4; // Smaller horizontal radius
        const radiusY = 10; // Larger vertical radius for more up/down motion
        const targetX = Math.cos(angle) * radiusX;
        const targetY = Math.sin(angle) * radiusY;

        // Add additional vertical bobbing motion
        const verticalBob = Math.sin(time * 0.0008) * 6; // Additional vertical motion
        const finalTargetY = targetY + verticalBob;

        // Interpolate towards target
        floating.velocityX += (targetX - floating.x) * waterLerpFactor;
        floating.velocityY += (finalTargetY - floating.y) * waterLerpFactor;
      } else {
        // Return to center when not talking
        floating.velocityX += (0 - floating.x) * waterLerpFactor;
        floating.velocityY += (0 - floating.y) * waterLerpFactor;
      }

      // Gentle rotation (water-like tilting) - reduced while talking
      const rotationAmount = isTalking ? 0.05 : 0.08; // Less rotation while talking
      const targetRotation = Math.sin(time * 0.0005) * rotationAmount;
      floating.velocityRotation +=
        (targetRotation - floating.rotation) * waterLerpFactor;

      // Apply high damping (water resistance) - extra damping while talking
      floating.velocityX *= waterDamping;
      floating.velocityY *= waterDamping;
      floating.velocityRotation *= waterDamping;

      // Update positions
      floating.x += floating.velocityX;
      floating.y += floating.velocityY;
      floating.rotation += floating.velocityRotation;

      // Combine local floating with drift (water current)
      const floatingX = floating.x + floating.driftX;
      const floatingY = floating.y + floating.driftY;
      const floatingRotation = floating.rotation;

      // Apply floating transform wrapper (water-like movement)
      ctx.save();
      ctx.translate(centerX + floatingX, centerY + floatingY);
      ctx.rotate(floatingRotation);
      ctx.translate(-centerX, -centerY);

      // Layer 1: Body (static - no movement) - using head as body if no body asset
      if (layerImagesRef.current.body) {
        ctx.drawImage(layerImagesRef.current.body, 0, 0, 500, 500);
      }

      // Layer 2: Hair Back (moves with head)
      if (layerImagesRef.current.hairBack) {
        const bobY = Math.sin(time * 0.0008) * 1.5;
        const bobX = Math.cos(time * 0.0012) * 1;
        const tiltAngle = Math.sin(time * 0.0005) * 0.02;

        ctx.save();
        ctx.translate(centerX + bobX, centerY + bobY);
        ctx.rotate(tiltAngle);
        ctx.translate(-centerX, -centerY);
        ctx.drawImage(layerImagesRef.current.hairBack, 0, 0, 500, 500);
        ctx.restore();
      }

      // Layer 3: Head (with micro-movements)
      const bobY = Math.sin(time * 0.0008) * 1.5;
      const bobX = Math.cos(time * 0.0012) * 1;
      const tiltAngle = Math.sin(time * 0.0005) * 0.02;

      // Look direction offset for facial features - use refs for current values
      const currentLookDirection = lookDirectionRef.current;
      const lookOffsetX = currentLookDirection.x * 15; // Max 15px horizontal
      const lookOffsetY = currentLookDirection.y * 10; // Max 10px vertical

      ctx.save();
      ctx.translate(centerX + bobX, centerY + bobY);
      ctx.rotate(tiltAngle);
      ctx.translate(-centerX, -centerY);

      // Draw head
      if (layerImagesRef.current.head) {
        ctx.drawImage(layerImagesRef.current.head, 0, 0, 500, 500);
      }

      // Layer 4: Eyebrows (with look direction) - use ref for current expression
      const currentExpression = expressionRef.current;
      const eyebrowImage =
        layerImagesRef.current.eyebrows[currentExpression] ||
        layerImagesRef.current.eyebrows.neutral;
      if (eyebrowImage) {
        ctx.save();
        ctx.translate(lookOffsetX, lookOffsetY);
        ctx.drawImage(eyebrowImage, 0, 0, 500, 500);
        ctx.restore();
      }

      // Layer 5: Eyes (with look direction) - use ref for current eye state
      const currentEyeState = eyeStateRef.current;
      const eyeImage =
        layerImagesRef.current.eyes[currentEyeState] ||
        layerImagesRef.current.eyes.open;
      if (eyeImage) {
        ctx.save();
        ctx.translate(lookOffsetX, lookOffsetY);
        ctx.drawImage(eyeImage, 0, 0, 500, 500);
        ctx.restore();
      }

      // Layer 6: Mouth (with look direction) - use ref for current mouth state
      const currentMouthState = mouthStateRef.current;
      const mouthImage =
        layerImagesRef.current.mouths[currentMouthState] ||
        layerImagesRef.current.mouths.closed;
      if (mouthImage) {
        ctx.save();
        ctx.translate(lookOffsetX, lookOffsetY);
        ctx.drawImage(mouthImage, 0, 0, 500, 500);
        ctx.restore();
      } else {
        // Debug: Log if mouth image is missing
        console.warn(
          '[PNGtuberAvatar] Mouth image not found for state:',
          currentMouthState,
          'Available:',
          Object.keys(layerImagesRef.current.mouths)
        );
      }

      ctx.restore(); // End head transform

      // Layer 7: Hair Front (moves with head)
      if (layerImagesRef.current.hairFront) {
        const bobY = Math.sin(time * 0.0008) * 1.5;
        const bobX = Math.cos(time * 0.0012) * 1;
        const tiltAngle = Math.sin(time * 0.0005) * 0.02;

        ctx.save();
        ctx.translate(centerX + bobX, centerY + bobY);
        ctx.rotate(tiltAngle);
        ctx.translate(-centerX, -centerY);
        ctx.drawImage(layerImagesRef.current.hairFront, 0, 0, 500, 500);
        ctx.restore();
      }

      ctx.restore(); // End floating transform wrapper

      // Layer 8: FX Effects (overlay on top of everything, no floating transform)
      const currentFx = fxRef.current;
      if (currentFx && layerImagesRef.current.fx[currentFx]) {
        ctx.drawImage(layerImagesRef.current.fx[currentFx], 0, 0, 500, 500);
      }
    };

    // Animation loop - runs continuously, uses refs for current state values
    useEffect(() => {
      if (!imagesLoaded) {
        console.log('[PNGtuberAvatar] Waiting for images to load...');
        return;
      }

      console.log('[PNGtuberAvatar] Starting animation loop');
      const animate = () => {
        timeRef.current += 16;
        drawAvatar(timeRef.current);
        animationRef.current = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [imagesLoaded]); // Only restart when images load, not on every state change

    // Load default assets on mount
    useEffect(() => {
      loadDefaultAssets();
    }, []);

    // Blinking system
    useEffect(() => {
      const scheduleNextBlink = () => {
        const delay = 2000 + Math.random() * 3000; // 2-5 seconds
        blinkTimerRef.current = setTimeout(() => {
          setEyeState('closed');
          setTimeout(() => {
            setEyeState('open');
            scheduleNextBlink();
          }, 150);
        }, delay);
      };

      scheduleNextBlink();

      return () => {
        if (blinkTimerRef.current) {
          clearTimeout(blinkTimerRef.current);
        }
      };
    }, []);

    // Random look direction changes
    useEffect(() => {
      const changeLookDirection = () => {
        const newX = (Math.random() - 0.5) * 0.6; // -0.3 to 0.3
        const newY = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2
        setLookDirection({ x: newX, y: newY });

        const delay = 3000 + Math.random() * 4000; // 3-7 seconds
        setTimeout(changeLookDirection, delay);
      };

      changeLookDirection();
    }, []);

    // Audio analysis for lip sync - using VRM's RMS-based adaptive detection system
    useEffect(() => {
      if (!analyser) {
        console.log('[PNGtuberAvatar] No analyser available, mouth closed');
        setMouthState('closed');
        setAudioLevel(0);
        return;
      }

      console.log(
        '[PNGtuberAvatar] Analyser connected, starting lip sync with VRM-style detection'
      );

      // Configuration constants matching VRM's LipSync system — imported from @/lib/audioConstants

      // Time domain data for RMS calculation (like VRM)
      const timeDomainData = new Float32Array(analyser.fftSize || 2048);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      let frameCount = 0;
      let lastMouthState = 'closed';
      let lastUpdateTime = 0;
      const updateInterval = 120; // Update mouth state every 120ms for smoother animation

      // Adaptive sensitivity tracking (like VRM)
      const rmsHistory: number[] = [];
      let adaptiveMin = 1.0;
      let adaptiveMax = 0.0;

      // Available mouth states for random selection (excluding closed)
      const talkingMouthStates: ('small' | 'medium' | 'large')[] = [
        'small',
        'medium',
        'large',
      ];

      const updateMouth = () => {
        if (!analyser) {
          setMouthState('closed');
          return;
        }

        // Get time domain data for RMS calculation (VRM method)
        analyser.getFloatTimeDomainData(timeDomainData);
        analyser.getByteFrequencyData(frequencyData);

        // Calculate RMS (Root Mean Square) - more stable than simple average (VRM method)
        let sumSquares = 0.0;
        const sampleCount = Math.min(RMS_WINDOW_SIZE, timeDomainData.length);

        for (let i = 0; i < sampleCount; i++) {
          const sample = timeDomainData[i];
          sumSquares += sample * sample;
        }

        const rms = Math.sqrt(sumSquares / sampleCount);

        // Update RMS history for adaptive sensitivity (VRM method)
        rmsHistory.push(rms);
        if (rmsHistory.length > HISTORY_WINDOW_SIZE) {
          rmsHistory.shift();
        }

        // Update adaptive min/max with smoothing (VRM method)
        if (rmsHistory.length > 10) {
          const sortedHistory = [...rmsHistory].sort((a, b) => a - b);
          const percentile10 =
            sortedHistory[Math.floor(sortedHistory.length * 0.1)];
          const percentile90 =
            sortedHistory[Math.floor(sortedHistory.length * 0.9)];

          // Smoothly adapt to new ranges
          adaptiveMin =
            adaptiveMin + (percentile10 - adaptiveMin) * ADAPTATION_RATE;
          adaptiveMax =
            adaptiveMax + (percentile90 - adaptiveMax) * ADAPTATION_RATE;

          // Ensure we have a reasonable range
          if (adaptiveMax - adaptiveMin < 0.01) {
            adaptiveMax = adaptiveMin + 0.01;
          }
        }

        // Normalize RMS to 0-1 range using adaptive min/max (VRM method)
        let normalizedRMS = 0.0;
        if (rms > NOISE_FLOOR) {
          normalizedRMS = (rms - adaptiveMin) / (adaptiveMax - adaptiveMin);
          normalizedRMS = Math.max(0, Math.min(1, normalizedRMS));
        }

        // Apply frequency-based enhancement for vowel sounds (VRM method)
        // Low-mid frequencies (100-1000 Hz) are important for vowel sounds
        let frequencyBoost = 0.0;
        if (frequencyData.length > 8) {
          // Focus on bins 2-8 which roughly correspond to vowel formants
          for (let i = 2; i < Math.min(8, frequencyData.length); i++) {
            frequencyBoost += frequencyData[i] / 255.0;
          }
          frequencyBoost /= 6; // Average
        }

        // Combine RMS and frequency analysis (VRM method)
        const audioLevel = normalizedRMS * 0.7 + frequencyBoost * 0.3;

        // Set audio level for display
        setAudioLevel(audioLevel * 255); // Scale to 0-255 range for compatibility

        // Determine if audio is present using adaptive threshold (VRM method)
        // Use normalized audio level with a threshold that adapts to the audio environment
        const hasAudio = audioLevel > 0.1; // Threshold for normalized 0-1 range

        let newMouthState: 'closed' | 'small' | 'medium' | 'large' = 'closed';

        if (hasAudio) {
          // Audio detected - randomly select from talking mouth states
          const now = Date.now();

          // Only update at intervals to prevent too rapid switching
          if (now - lastUpdateTime >= updateInterval) {
            // Randomly pick a talking mouth state
            const randomIndex = Math.floor(
              Math.random() * talkingMouthStates.length
            );
            newMouthState = talkingMouthStates[randomIndex];
            lastUpdateTime = now;
          } else {
            // Keep current state if we're within the update interval
            newMouthState = lastMouthState as
              | 'closed'
              | 'small'
              | 'medium'
              | 'large';
          }
        } else {
          // No audio - mouth closed
          newMouthState = 'closed';
        }

        // Only update state if it changed
        if (newMouthState !== lastMouthState) {
          setMouthState(newMouthState);
          lastMouthState = newMouthState;

          // Log when mouth state changes
          if (hasAudio) {
            console.log(
              '[PNGtuberAvatar] Mouth state (VRM-style detection):',
              newMouthState,
              'Audio level:',
              audioLevel.toFixed(3),
              'RMS:',
              rms.toFixed(4)
            );
          }
        }

        // Log audio levels periodically for debugging
        if (frameCount % 120 === 0 && audioLevel > 0) {
          console.log(
            '[PNGtuberAvatar] Audio detected (VRM-style), Level:',
            audioLevel.toFixed(3),
            'Adaptive range:',
            adaptiveMin.toFixed(4),
            '-',
            adaptiveMax.toFixed(4)
          );
        }
        frameCount++;

        requestAnimationFrame(updateMouth);
      };

      updateMouth();

      return () => {
        console.log('[PNGtuberAvatar] Stopping lip sync');
        setMouthState('closed');
      };
    }, [analyser]);

    return (
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className={className}
        style={{
          imageRendering: 'auto',
          width: '100%',
          height: '100%',
          minWidth: '210px',
          minHeight: '210px',
          display: 'block',
        }}
      />
    );
  }
);

PNGtuberAvatar.displayName = 'PNGtuberAvatar';

export default PNGtuberAvatar;

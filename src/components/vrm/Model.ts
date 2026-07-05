/* eslint-disable @typescript-eslint/no-explicit-any */
import { VRM, VRMExpressionPresetName, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';

import { getAudioContext } from '@/lib/audioContext';
import useAgentStore from '@/store/useAgentStore';
import useSocketChatStore from '@/store/useSocketChatStore';
import useVRMStore, { AnimationOptions } from '@/store/vrmStore';
import { AnimationStates } from '@/types/agent';

import { EmoteController } from './emoteController/emoteController';
import { LipSync } from './lipSync/lipSync';
import { Screenplay } from './messages/messages';
import { VRMAnimation } from './VRMAnimation/VRMAnimation';

const DEBUG_ANIMATION =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEBUG_ANIM === 'true';
const DEBUG_VRM =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEBUG_VRM === 'true';

/**
 * The Model class wraps a VRM instance plus Audio + Anim mixers + cross-fade logic.
 */
export class Model {
  public vrm?: VRM | null;
  public mixer?: THREE.AnimationMixer;
  public emoteController?: EmoteController;
  public isSpeaking: boolean = false;
  public onSpeechEnd?: () => void;
  public onAnimationComplete?: () => void;
  /** Fired when a synthetic-speech turn finishes naturally (duration elapsed). */
  public onSyntheticSpeechEnd?: () => void;
  public isLoaded: boolean = false;
  public idleAnimation?: THREE.AnimationAction;
  public actionAnimation?: THREE.AnimationAction;
  private _lookAtTargetParent: THREE.Object3D;
  private _lipSync?: LipSync;
  private _audioContext?: AudioContext;
  private _gainNode?: GainNode;
  private _clock: THREE.Clock;
  private idleTransitionTimeout?: ReturnType<typeof setTimeout>;
  private actionTransitionTimeout?: ReturnType<typeof setTimeout>;
  private loopListener?: () => void;
  private _speechFinished: boolean = false;
  private _animationFinished: boolean = false;
  private _animationCompletionCallbackFired: boolean = false;
  private _pendingIdleTransition: boolean = false;
  private _debugInterval?: ReturnType<typeof setInterval>;
  private _lastAnimationStateLog?: string;
  private _lipSyncDebugInterval?: ReturnType<typeof setInterval>;
  private _enableLipSyncDebug: boolean = false;
  private _isTransitioning: boolean = false;

  // Viseme randomization state
  private _visemeOptions: VRMExpressionPresetName[] = ['aa', 'ee', 'ou'];
  private _activeViseme: VRMExpressionPresetName = 'aa';
  private _nextVisemeSwitchTime: number = 0; // seconds, based on clock elapsed time
  private _visemeSwitchMinMaxSec: [number, number] = [0.25, 0.6];
  private _previousVolume: number = 1; // Track previous volume to detect changes

  // Synthetic-speech state (used only when volume === 0).
  // Drives mouth visemes from a synthetic envelope keyed off message length so
  // the avatar still appears to talk while muted, with no real audio playing.
  private _synthActive: boolean = false;
  private _synthElapsedMs: number = 0;
  private _synthDurationMs: number = 0;
  private _synthVolume: number = 0;
  private readonly _synthMouthShapes: VRMExpressionPresetName[] = [
    'aa',
    'ee',
    'ou',
  ];
  private _synthMouthShapeIndex: number = 0;
  private _synthMouthShapeChangeTimerMs: number = 0;
  private _synthMouthShapeNextIntervalMs: number = 200;
  // Tick interval is rolled fresh after each switch to break up rhythmic
  // patterns. Lower bound keeps mouth lively, upper bound gives each viseme
  // enough dwell time to actually reach its amplitude target before the
  // next switch (the blendshape needs ~80-120ms to ease in).
  private readonly _synthMouthShapeIntervalMinMs: number = 140;
  private readonly _synthMouthShapeIntervalMaxMs: number = 260;
  private readonly _synthFadeInMs: number = 200;
  private readonly _synthFadeOutMs: number = 200;
  private readonly _synthMinDurationMs: number = 2000;
  private readonly _synthMsPerChar: number = 50;
  // Per-viseme amplitude target. Re-rolled on each viseme tick so different
  // visemes drive different amounts of the blendshape range, which reads as
  // natural variation in how "open" the mouth is on each shape.
  private _synthVisemeAmplitude: number = 0.85;
  private readonly _synthVisemeAmplitudeMin: number = 0.7;
  private readonly _synthVisemeAmplitudeMax: number = 1.0;
  private readonly _synthPerFrameJitter: number = 0.05;
  // Crossfade time between synthetic visemes. Kept much shorter than the
  // real-audio default (0.2s) so that the new viseme reaches its target
  // amplitude well before the next switch fires, even at the fast end of
  // the tick interval. Tune up if switches feel snappy, down if visemes
  // are still being clipped before reaching full target.
  private readonly _synthVisemeTransitionSeconds: number = 0.08;

  constructor(lookAtTargetParent: THREE.Object3D) {
    this._lookAtTargetParent = lookAtTargetParent;
    this._clock = new THREE.Clock();
    if (DEBUG_VRM) {
      this.startDebugLogging();
      this.enableLipSyncDebug(true);
    }
  }

  /**
   * Easing functions for smooth transitions
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  private easeInQuart(t: number): number {
    return t * t * t * t;
  }

  /**
   * Start a gradual weight-based transition between two animations with custom easing
   */
  private startGradualTransition(
    fromAction: THREE.AnimationAction,
    toAction: THREE.AnimationAction,
    duration: number,
    easingType:
      | 'smoothstep'
      | 'easeInOutCubic'
      | 'easeOutQuart'
      | 'easeInQuart' = 'easeInOutCubic'
  ): void {
    const startTime = this._clock.getElapsedTime();
    const startWeight = fromAction.getEffectiveWeight();

    // Mark that we're transitioning to prevent bone smoother interference
    this._isTransitioning = true;

    if (DEBUG_ANIMATION) {
      console.log('[Model] Starting gradual transition:', {
        fromWeight: startWeight,
        duration: duration,
        easingType: easingType,
        fromAction: fromAction.getClip().name,
        toAction: toAction.getClip().name,
      });
    }

    const updateTransition = () => {
      const elapsed = this._clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Apply easing function
      let easedProgress: number;
      switch (easingType) {
        case 'smoothstep':
          easedProgress = progress * progress * (3 - 2 * progress);
          break;
        case 'easeInOutCubic':
          easedProgress = this.easeInOutCubic(progress);
          break;
        case 'easeOutQuart':
          easedProgress = this.easeOutQuart(progress);
          break;
        case 'easeInQuart':
          easedProgress = this.easeInQuart(progress);
          break;
        default:
          easedProgress = this.easeInOutCubic(progress);
      }

      // Gradually decrease old animation weight and increase new animation weight
      const newWeight = easedProgress;
      const oldWeight = startWeight * (1 - easedProgress);

      fromAction.setEffectiveWeight(oldWeight);
      toAction.setEffectiveWeight(newWeight);

      if (progress < 1.0) {
        // Continue the transition
        requestAnimationFrame(updateTransition);
      } else {
        // Transition complete
        fromAction.setEffectiveWeight(0);
        toAction.setEffectiveWeight(1);
        this._isTransitioning = false; // Re-enable bone smoothing
        if (DEBUG_ANIMATION) {
          console.log('[Model] Gradual transition completed');
        }
      }
    };

    // Start the transition
    requestAnimationFrame(updateTransition);
  }

  /**
   * Check if currently transitioning between animations
   */
  public isTransitioning(): boolean {
    return this._isTransitioning;
  }

  /**
   * Custom fade in with smooth easing
   */
  private fadeInWithEasing(
    action: THREE.AnimationAction,
    duration: number,
    easingType:
      | 'easeInOutCubic'
      | 'easeOutQuart'
      | 'easeInQuart' = 'easeOutQuart'
  ): void {
    const startTime = this._clock.getElapsedTime();
    const startWeight = action.getEffectiveWeight();
    const targetWeight = 1.0;

    if (DEBUG_ANIMATION) {
      console.log('[Model] Starting fade in with easing:', {
        duration: duration,
        easingType: easingType,
        startWeight: startWeight,
        targetWeight: targetWeight,
      });
    }

    const updateFade = () => {
      const elapsed = this._clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Apply easing function
      let easedProgress: number;
      switch (easingType) {
        case 'easeInOutCubic':
          easedProgress = this.easeInOutCubic(progress);
          break;
        case 'easeOutQuart':
          easedProgress = this.easeOutQuart(progress);
          break;
        case 'easeInQuart':
          easedProgress = this.easeInQuart(progress);
          break;
        default:
          easedProgress = this.easeOutQuart(progress);
      }

      const newWeight =
        startWeight + (targetWeight - startWeight) * easedProgress;
      action.setEffectiveWeight(newWeight);

      if (progress < 1.0) {
        requestAnimationFrame(updateFade);
      } else {
        action.setEffectiveWeight(targetWeight);
        if (DEBUG_ANIMATION) {
          console.log('[Model] Fade in completed');
        }
      }
    };

    requestAnimationFrame(updateFade);
  }

  /**
   * Custom fade out with smooth easing
   */
  private fadeOutWithEasing(
    action: THREE.AnimationAction,
    duration: number,
    easingType:
      | 'easeInOutCubic'
      | 'easeOutQuart'
      | 'easeInQuart' = 'easeInQuart'
  ): void {
    const startTime = this._clock.getElapsedTime();
    const startWeight = action.getEffectiveWeight();
    const targetWeight = 0.0;

    if (DEBUG_ANIMATION) {
      console.log('[Model] Starting fade out with easing:', {
        duration: duration,
        easingType: easingType,
        startWeight: startWeight,
        targetWeight: targetWeight,
      });
    }

    const updateFade = () => {
      const elapsed = this._clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Apply easing function
      let easedProgress: number;
      switch (easingType) {
        case 'easeInOutCubic':
          easedProgress = this.easeInOutCubic(progress);
          break;
        case 'easeOutQuart':
          easedProgress = this.easeOutQuart(progress);
          break;
        case 'easeInQuart':
          easedProgress = this.easeInQuart(progress);
          break;
        default:
          easedProgress = this.easeInQuart(progress);
      }

      const newWeight =
        startWeight + (targetWeight - startWeight) * easedProgress;
      action.setEffectiveWeight(newWeight);

      if (progress < 1.0) {
        requestAnimationFrame(updateFade);
      } else {
        action.setEffectiveWeight(targetWeight);
        if (DEBUG_ANIMATION) {
          console.log('[Model] Fade out completed');
        }
      }
    };

    requestAnimationFrame(updateFade);
  }

  /**
   * Custom cross-fade with smooth easing
   */
  private crossFadeWithEasing(
    fromAction: THREE.AnimationAction,
    toAction: THREE.AnimationAction,
    duration: number,
    easingType:
      | 'easeInOutCubic'
      | 'easeOutQuart'
      | 'easeInQuart' = 'easeInOutCubic'
  ): void {
    const startTime = this._clock.getElapsedTime();
    const fromStartWeight = fromAction.getEffectiveWeight();
    const toStartWeight = toAction.getEffectiveWeight();

    if (DEBUG_ANIMATION) {
      console.log('[Model] Starting cross-fade with easing:', {
        duration: duration,
        easingType: easingType,
        fromStartWeight: fromStartWeight,
        toStartWeight: toStartWeight,
      });
    }

    const updateCrossFade = () => {
      const elapsed = this._clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Apply easing function
      let easedProgress: number;
      switch (easingType) {
        case 'easeInOutCubic':
          easedProgress = this.easeInOutCubic(progress);
          break;
        case 'easeOutQuart':
          easedProgress = this.easeOutQuart(progress);
          break;
        case 'easeInQuart':
          easedProgress = this.easeInQuart(progress);
          break;
        default:
          easedProgress = this.easeInOutCubic(progress);
      }

      // Fade out from action, fade in to action
      const fromWeight = fromStartWeight * (1 - easedProgress);
      const toWeight = toStartWeight + (1 - toStartWeight) * easedProgress;

      fromAction.setEffectiveWeight(fromWeight);
      toAction.setEffectiveWeight(toWeight);

      if (progress < 1.0) {
        requestAnimationFrame(updateCrossFade);
      } else {
        fromAction.setEffectiveWeight(0);
        toAction.setEffectiveWeight(1);
        if (DEBUG_ANIMATION) {
          console.log('[Model] Cross-fade completed');
        }
      }
    };

    requestAnimationFrame(updateCrossFade);
  }

  // Add lip sync debug logging
  public enableLipSyncDebug(enable: boolean = true) {
    this._enableLipSyncDebug = enable;

    if (enable && !this._lipSyncDebugInterval) {
      this._lipSyncDebugInterval = setInterval(() => {
        if (this._lipSync && this.isSpeaking) {
          const range = this._lipSync.getAdaptiveRange();
          console.log('[LipSync Debug]', {
            min: range.min.toFixed(4),
            max: range.max.toFixed(4),
            current: range.current.toFixed(4),
            normalized: (
              (range.current - range.min) /
              (range.max - range.min)
            ).toFixed(2),
          });
        }
      }, 100);
    } else if (!enable) {
      this.stopLipSyncDebugLogging();
    }
  }

  public unLoadVrm({ dispose = true }: { dispose?: boolean } = {}) {
    this.stopDebugLogging();
    this.stopLipSyncDebugLogging();
    this.stopSyntheticSpeech();
    if (this.vrm) {
      if (dispose) {
        VRMUtils.deepDispose(this.vrm.scene);
      }
      this.vrm = null;
      this.isLoaded = false;
    }
  }

  /**
   * Compute synthetic-speech duration from a message text length.
   * Matches the heuristic used by the 2D avatar's `isSimChatActive` path
   * (~50ms per character, minimum 2 seconds).
   */
  private computeSyntheticDurationMs(text: string): number {
    const length = text?.length ?? 0;
    return Math.max(length * this._synthMsPerChar, this._synthMinDurationMs);
  }

  /**
   * Roll a fresh per-viseme amplitude target in
   * `[_synthVisemeAmplitudeMin, _synthVisemeAmplitudeMax]`.
   */
  private rollSynthVisemeAmplitude(): number {
    const min = this._synthVisemeAmplitudeMin;
    const max = this._synthVisemeAmplitudeMax;
    return min + Math.random() * (max - min);
  }

  /**
   * Roll a fresh viseme tick interval in
   * `[_synthMouthShapeIntervalMinMs, _synthMouthShapeIntervalMaxMs]`.
   * Adding randomness to the tick spacing breaks up rhythmic patterns and
   * keeps the mouth from looking like it's switching on a metronome.
   */
  private rollSynthMouthShapeIntervalMs(): number {
    const min = this._synthMouthShapeIntervalMinMs;
    const max = this._synthMouthShapeIntervalMaxMs;
    return min + Math.random() * (max - min);
  }

  /**
   * Pick a synthetic-speech viseme index different from the currently
   * active one, drawn uniformly from the remaining shapes. Falls back to
   * the current index if the shape list has only one entry.
   */
  private pickRandomNonRepeatVisemeIndex(): number {
    const shapes = this._synthMouthShapes;
    if (shapes.length <= 1) {
      return this._synthMouthShapeIndex;
    }
    const candidates: number[] = [];
    for (let i = 0; i < shapes.length; i++) {
      if (i !== this._synthMouthShapeIndex) {
        candidates.push(i);
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Start a synthetic-speech turn for the given message text.
   * Idempotent: if already active, this is a no-op (use `extendSyntheticSpeech`
   * to grow the duration as more text streams in).
   */
  public startSyntheticSpeech(text: string): void {
    if (this._synthActive) {
      return;
    }
    this._synthActive = true;
    this._synthElapsedMs = 0;
    this._synthDurationMs = this.computeSyntheticDurationMs(text);
    this._synthVolume = 0;
    // Random init so multiple VRMs on screen don't lock-step their mouths.
    this._synthMouthShapeIndex = Math.floor(
      Math.random() * this._synthMouthShapes.length
    );
    this._synthMouthShapeNextIntervalMs = this.rollSynthMouthShapeIntervalMs();
    this._synthMouthShapeChangeTimerMs =
      Math.random() * this._synthMouthShapeNextIntervalMs;
    this._synthVisemeAmplitude = this.rollSynthVisemeAmplitude();
    this.isSpeaking = true;
    console.log(
      `[Model] 🎙️ Synthetic speech START (${text.length} chars, ${this._synthDurationMs}ms)`
    );
  }

  /**
   * Recompute the remaining synthetic-speech duration as text grows.
   * Only ever extends; will not shorten an in-flight turn.
   */
  public extendSyntheticSpeech(text: string): void {
    if (!this._synthActive) {
      return;
    }
    const newDuration = this.computeSyntheticDurationMs(text);
    if (newDuration > this._synthDurationMs) {
      this._synthDurationMs = newDuration;
    }
  }

  /**
   * Cancel an in-flight synthetic-speech turn immediately.
   * Resets visemes and clears state without firing onSyntheticSpeechEnd.
   */
  public stopSyntheticSpeech(): void {
    if (!this._synthActive) {
      return;
    }
    this._synthActive = false;
    this._synthElapsedMs = 0;
    this._synthDurationMs = 0;
    this._synthVolume = 0;
    this.isSpeaking = false;
    this.emoteController?.resetMouthShapes();
    console.log('[Model] 🎙️ Synthetic speech STOP');
  }

  /**
   * Drive synthetic mouth visemes for the current frame.
   * Called from `update(delta)` when the synthetic branch is active.
   */
  private updateSyntheticSpeech(delta: number): void {
    const deltaMs = delta * 1000;
    this._synthElapsedMs += deltaMs;

    // Auto-end when duration elapses.
    if (this._synthElapsedMs >= this._synthDurationMs) {
      const callback = this.onSyntheticSpeechEnd;
      this.stopSyntheticSpeech();
      if (callback) {
        try {
          callback();
        } catch (err) {
          console.error('[Model] onSyntheticSpeechEnd handler threw:', err);
        }
      }
      return;
    }

    // Advance the viseme on a randomized tick interval, picking a
    // uniformly-random viseme from the non-current shapes (so the same
    // shape never plays twice in a row). Tick spacing and per-viseme
    // amplitude are both re-rolled each tick — together this gives a
    // visibly less rhythmic, more organic mouth motion than a fixed
    // forward/back walk.
    this._synthMouthShapeChangeTimerMs += deltaMs;
    if (
      this._synthMouthShapeChangeTimerMs >= this._synthMouthShapeNextIntervalMs
    ) {
      this._synthMouthShapeChangeTimerMs = 0;
      this._synthMouthShapeIndex = this.pickRandomNonRepeatVisemeIndex();
      this._synthVisemeAmplitude = this.rollSynthVisemeAmplitude();
      this._synthMouthShapeNextIntervalMs =
        this.rollSynthMouthShapeIntervalMs();
    }

    // Synthetic volume envelope: per-viseme amplitude target (rolled each
    // tick into [_synthVisemeAmplitudeMin, _synthVisemeAmplitudeMax]) with
    // linear fade-in / fade-out at the edges, plus a small per-frame jitter
    // so the mouth has subtle motion within a single viseme.
    const remainingMs = this._synthDurationMs - this._synthElapsedMs;
    let envelope = this._synthVisemeAmplitude;
    if (this._synthElapsedMs < this._synthFadeInMs) {
      envelope *= this._synthElapsedMs / this._synthFadeInMs;
    } else if (remainingMs < this._synthFadeOutMs) {
      envelope *= Math.max(0, remainingMs / this._synthFadeOutMs);
    }
    const jitter = (Math.random() - 0.5) * 2 * this._synthPerFrameJitter;
    this._synthVolume = Math.max(0, Math.min(1, envelope + jitter));

    const viseme = this._synthMouthShapes[this._synthMouthShapeIndex];
    this.emoteController?.lipSync(
      viseme,
      this._synthVolume
    );
  }

  /**
   * Called every frame from your R3F's useFrame to update lips, expressions, etc.
   */
  public update(delta: number): void {
    // Check if volume is 0 (muted) - disable lip sync if so
    const currentVolume = this.getVolume();

    // Only reset mouth shapes when volume changes from > 0 to 0
    if (currentVolume === 0 && this._previousVolume > 0) {
      // Volume just became muted - reset all mouth shapes to 0
      this.emoteController?.resetMouthShapes();
      this._activeViseme = 'aa';
    }
    this._previousVolume = currentVolume;

    if (this._lipSync && currentVolume > 0) {
      const { volume } = this._lipSync.update();

      // When speaking, occasionally switch between 'aa', 'ee', 'ou' smoothly
      if (this.isSpeaking) {
        const now = this._clock.getElapsedTime();
        if (now >= this._nextVisemeSwitchTime && volume > 0.05) {
          // choose a different viseme than current
          const candidates = this._visemeOptions.filter(
            (v) => v !== this._activeViseme
          );
          if (candidates.length > 0) {
            const idx = Math.floor(Math.random() * candidates.length);
            this._activeViseme = candidates[idx];
          }
          const [minS, maxS] = this._visemeSwitchMinMaxSec;
          const interval = minS + Math.random() * (maxS - minS);
          this._nextVisemeSwitchTime = now + interval;
        }
      } else {
        // Not speaking: keep default
        this._activeViseme = 'aa';
      }

      this.emoteController?.lipSync(this._activeViseme, volume);
    } else if (this._synthActive) {
      // Synthetic-speech path: drives visemes from a length-based envelope so
      // the avatar still looks like it's talking while muted (or while the CMS
      // Enable Sound Button is off, which forces volume=0 on mount). The real
      // audio path above always wins when volume > 0, so this branch is
      // strictly limited to the muted scenario.
      this.updateSyntheticSpeech(delta);
    } else if (currentVolume === 0) {
      // Volume is muted - skip lip sync but don't reset mouth shapes every frame
      // (already reset above when volume changed to 0)
      this._activeViseme = 'aa';
    }

    this.emoteController?.update(delta);

    // Update animation controller BEFORE mixer
    const controller = useVRMStore.getState().animationController;
    if (controller) {
      controller.update(delta);
    }

    // Mixer is updated inside the controller, so we don't update it here
    // this.mixer?.update(delta); // ❌ REMOVED - causes double update!

    this.vrm?.update(delta);
  }

  /**
   * For IDLE animations
   */
  public async loadIdleAnimation(vrmAnimation: VRMAnimation): Promise<void> {
    console.log('[Model] ============ LOAD IDLE ANIMATION START ============');
    if (!this.vrm || !this.mixer) {
      console.warn(
        '[Model] VRM or mixer not ready, cannot load idle animation'
      );
      return;
    }

    const clip = vrmAnimation.createAnimationClip(this.vrm);
    console.log('[Model] Created animation clip:', {
      name: clip.name,
      duration: clip.duration,
      tracks: clip.tracks.length,
    });

    const newIdleAction = this.mixer.clipAction(clip);
    newIdleAction.loop = THREE.LoopRepeat;
    newIdleAction.enabled = true;
    newIdleAction.setEffectiveTimeScale(1);

    console.log('[Model] New idle action created:', {
      loop: newIdleAction.loop,
      enabled: newIdleAction.enabled,
      paused: newIdleAction.paused,
    });

    // If there's an existing idle animation, cross-fade
    if (this.idleAnimation && this.idleAnimation !== newIdleAction) {
      const oldIdleState = {
        isRunning: this.idleAnimation.isRunning(),
        weight: this.idleAnimation.getEffectiveWeight(),
        enabled: this.idleAnimation.enabled,
      };
      console.log('[Model] Old idle state:', oldIdleState);

      if (this.idleAnimation.isRunning()) {
        console.log('[Model] Smoothly transitioning from old idle to new idle');
        // Start new animation at weight 0 and gradually increase
        newIdleAction.setEffectiveWeight(0);
        newIdleAction.play();

        // Use a more gradual weight-based transition instead of crossFadeFrom
        this.startGradualTransition(
          this.idleAnimation,
          newIdleAction,
          0.5,
          'easeInOutCubic'
        );
      } else {
        console.log('[Model] Old idle not running, starting new idle directly');
        newIdleAction.setEffectiveWeight(1);
        newIdleAction.play();
      }

      if (this.idleTransitionTimeout) clearTimeout(this.idleTransitionTimeout);
      const oldIdle = this.idleAnimation;

      this.idleTransitionTimeout = setTimeout(() => {
        console.log('[Model] Cleaning up old idle animation');
        oldIdle.stop();
        this.mixer?.uncacheAction(oldIdle.getClip());
      }, 600); // 0.6 seconds to allow for 0.5-second transition
    } else {
      // No previous idle, just play
      console.log('[Model] No previous idle, starting new idle directly');
      newIdleAction.setEffectiveWeight(1);
      newIdleAction.play();
    }

    this.idleAnimation = newIdleAction;
    console.log('[Model] Idle animation set. Final state:', {
      isRunning: this.idleAnimation.isRunning(),
      weight: this.idleAnimation.getEffectiveWeight(),
      enabled: this.idleAnimation.enabled,
    });
    console.log('[Model] ============ LOAD IDLE ANIMATION END ============');
  }

  /**
   * For "TALK" or other "action" animations
   */
  public async playActionAnimation(
    vrmAnimation: VRMAnimation,
    options?: AnimationOptions
  ) {
    console.log(
      '[Model] ============ PLAY ACTION ANIMATION START v2.2 ============'
    );
    console.log('[Model] 🎬 PLAYING Animation:', {
      animationName: (vrmAnimation as any).__animationId
        ? `ID: ${(vrmAnimation as any).__animationId}`
        : 'Unknown',
      options: options,
    });

    if (!this.vrm || !this.mixer) {
      console.warn(
        '[Model] ❌ VRM or mixer not ready, cannot play action animation'
      );
      return;
    }

    const clip = vrmAnimation.createAnimationClip(this.vrm);
    console.log('[Model] ✅ Created action clip:', {
      name: clip.name,
      duration: clip.duration,
      tracks: clip.tracks.length,
      options: options,
    });

    // Store previous action for smooth cross-fade
    const previousAction = this.actionAnimation;

    this._speechFinished = false;
    this._animationFinished = false;
    this._pendingIdleTransition = false;

    const action = this.mixer.clipAction(clip);
    action.loop = options?.loop ? THREE.LoopRepeat : THREE.LoopOnce;
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveTimeScale(1);

    console.log('[Model] New action created:', {
      loop: action.loop,
      clampWhenFinished: action.clampWhenFinished,
      enabled: action.enabled,
    });

    // Check idle animation state
    const idleState = {
      exists: !!this.idleAnimation,
      isRunning: this.idleAnimation?.isRunning() || false,
      weight: this.idleAnimation?.getEffectiveWeight() || 0,
      enabled: this.idleAnimation?.enabled || false,
    };
    console.log('[Model] Current idle state before cross-fade:', idleState);

    // Start action and handle cross-fade
    action.setEffectiveWeight(0.1); // Start at 0.1 weight to reduce stutter
    action.play();

    // Reset animation completion callback flag for new animation
    this._animationCompletionCallbackFired = false;
    console.log('[Model] ▶️ ACTION STARTED PLAYING:', {
      animationName: (vrmAnimation as any).__animationId
        ? `ID: ${(vrmAnimation as any).__animationId}`
        : 'Unknown',
      loop: action.loop,
      weight: action.getEffectiveWeight(),
      enabled: action.enabled,
      isRunning: action.isRunning(),
    });

    // Cross-fade from previous animation (idle or action)
    if (previousAction && previousAction.isRunning()) {
      console.log(
        '[Model] Cross-fading from previous action to new action with custom easing'
      );
      // Use custom cross-fade with smooth easing for action-to-action transition
      this.crossFadeWithEasing(previousAction, action, 2.0, 'easeInOutCubic');

      // Clean up previous action after transition
      if (this.actionTransitionTimeout)
        clearTimeout(this.actionTransitionTimeout);
      this.actionTransitionTimeout = setTimeout(() => {
        console.log('[Model] Stopping previous action');
        previousAction?.stop();
        if (previousAction) this.mixer?.uncacheAction(previousAction.getClip());
      }, 2100);
    } else if (
      this.idleAnimation &&
      this.idleAnimation.isRunning() &&
      this.idleAnimation.getEffectiveWeight() > 0
    ) {
      console.log(
        '[Model] Cross-fading from idle to action with custom easing'
      );
      // Use custom cross-fade with smooth easing
      this.crossFadeWithEasing(
        this.idleAnimation,
        action,
        2.0,
        'easeInOutCubic'
      );
    } else {
      console.log(
        '[Model] No previous animation running, fading in action from 0.1 weight'
      );
      // Fade in the action from 0.1 weight
      this.fadeInWithEasing(action, 2.0, 'easeInOutCubic');
    }

    this.actionAnimation = action;
    console.log('[Model] Action animation set. Final state:', {
      isRunning: this.actionAnimation.isRunning(),
      weight: this.actionAnimation.getEffectiveWeight(),
      time: this.actionAnimation.time,
    });

    // Handle looping animations
    if (options?.loop && this.loopListener) {
      this.mixer.removeEventListener('loop', this.loopListener);
      this.loopListener = undefined;
    }

    if (options?.loop) {
      console.log('[Model] Setting up loop listener');
      const onLoop = () => {
        console.log('[Model] Animation loop triggered');
        // Reset VRM position to prevent drifting
        if (this.vrm?.scene) {
          this.vrm.scene.position.set(0, 0, 0);
          const hipsBone = this.vrm.humanoid.getNormalizedBoneNode('hips');
          if (hipsBone) {
            const originalPose = this.vrm.humanoid.getNormalizedAbsolutePose();
            if (originalPose.hips?.position) {
              hipsBone.position.set(
                originalPose.hips.position[0],
                originalPose.hips.position[1],
                originalPose.hips.position[2]
              );
            }
          }
        }
      };

      this.mixer.addEventListener('loop', onLoop);
      this.loopListener = onLoop;
    }

    // Handle non-looping animations
    if (!options?.loop) {
      console.log('[Model] Setting up finish listener');
      const onFinished = (
        event: THREE.Event & { action: THREE.AnimationAction }
      ) => {
        if (
          event.action === this.actionAnimation &&
          !this._animationCompletionCallbackFired
        ) {
          console.log('[Model] Action animation finished event triggered');
          this.mixer?.removeEventListener('finished', onFinished);
          this._animationFinished = true;
          this._animationCompletionCallbackFired = true;
          console.log('[Model] Animation finished. States:', {
            speechFinished: this._speechFinished,
            pendingIdleTransition: this._pendingIdleTransition,
          });

          // Call animation completion callback if set
          if (this.onAnimationComplete) {
            console.log('[Model] Calling animation completion callback');
            this.onAnimationComplete();
          }

          if (this._speechFinished || this._pendingIdleTransition) {
            console.log('[Model] Triggering stop action from finish event');
            this._pendingIdleTransition = false;
            this.stopActionAnimation();
          }
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
    console.log('[Model] ============ PLAY ACTION ANIMATION END ============');
  }

  /**
   * Revert to idle after finishing action animation
   */
  public stopActionAnimation() {
    console.log(
      '[Model] ============ STOP ACTION ANIMATION START ============'
    );

    if (!this.actionAnimation) {
      console.log('[Model] No action animation to stop');
      return;
    }

    const actionState = {
      isRunning: this.actionAnimation.isRunning(),
      weight: this.actionAnimation.getEffectiveWeight(),
      time: this.actionAnimation.time,
      duration: this.actionAnimation.getClip().duration,
      loop: this.actionAnimation.loop,
    };
    console.log('[Model] Current action state:', actionState);

    // Remove loop listener if it exists
    if (this.loopListener && this.mixer) {
      console.log('[Model] Removing loop listener');
      this.mixer.removeEventListener('loop', this.loopListener);
      this.loopListener = undefined;
    }

    const oldAction = this.actionAnimation;

    // Check and ensure idle animation state
    const idleState = {
      exists: !!this.idleAnimation,
      isRunning: this.idleAnimation?.isRunning() || false,
      weight: this.idleAnimation?.getEffectiveWeight() || 0,
      enabled: this.idleAnimation?.enabled || false,
    };
    console.log('[Model] Current idle state:', idleState);

    if (this.idleAnimation) {
      if (!this.idleAnimation.isRunning()) {
        console.log('[Model] Idle not running, restarting it');
        this.idleAnimation.reset();
        this.idleAnimation.enabled = true;
        this.idleAnimation.setEffectiveWeight(1); // Start at full weight to avoid T-pose
        this.idleAnimation.play();
        console.log('[Model] Idle restarted with weight 1');
      } else {
        console.log('[Model] Idle running, fading it in with custom easing');
        this.fadeInWithEasing(this.idleAnimation, 2.0, 'easeOutQuart');
      }
      console.log('[Model] Fading out action with custom easing');
      this.fadeOutWithEasing(oldAction, 2.0, 'easeInQuart');
    } else {
      console.warn(
        '[Model] WARNING: No idle animation available! Just fading out action with custom easing'
      );
      this.fadeOutWithEasing(oldAction, 2.0, 'easeInQuart');
    }

    // Clean up after fade
    if (this.actionTransitionTimeout)
      clearTimeout(this.actionTransitionTimeout);
    this.actionTransitionTimeout = setTimeout(() => {
      console.log('[Model] Cleaning up action animation');
      oldAction.stop();
      this.mixer?.uncacheAction(oldAction.getClip());

      // Final state check
      if (this.idleAnimation) {
        console.log('[Model] Final idle state after cleanup:', {
          isRunning: this.idleAnimation.isRunning(),
          weight: this.idleAnimation.getEffectiveWeight(),
        });
      }
    }, 2100);

    this.actionAnimation = undefined;
    console.log('[Model] ============ STOP ACTION ANIMATION END ============');
  }

  /**
   * Basic TTS from array buffer => plays talk animation if talkAnimationId or if agent has a "TALK" animation
   */
  public async speakFromBuffer(
    audio: ArrayBuffer,
    text?: string,
    talkAnimationId?: number
  ) {
    console.log('[Model] ============ SPEAK FROM BUFFER START ============');
    // 🔧 FIX: For multi-chunk sequences, allow new chunks to start
    // The socket store manages the queue, so we should process chunks sequentially
    // Only reject if we're actively playing (isSpeaking true AND not finished)
    if (this.isSpeaking && !this._speechFinished) {
      console.log(
        '[Model] Previous chunk still playing, will queue after it finishes'
      );
      // The onSpeechEnd callback will trigger the next chunk via playNextAudio()
      return;
    }
    // Reset state for new chunk
    this.isSpeaking = true;
    this._speechFinished = false;

    if (talkAnimationId == null) {
      const { selectedAgent, allAgents } = useAgentStore.getState();
      const foundAgent = allAgents.find((a) => a.id === selectedAgent);
      if (foundAgent && foundAgent.animations) {
        const talkEntry = foundAgent.animations.find(
          (anim) => anim.state === AnimationStates.TALK
        );

        if (talkEntry?.animationId) {
          talkAnimationId = talkEntry.animationId;
          console.log('[Model] Found talk animation ID:', talkAnimationId);
        }
      }
    }

    try {
      this.initAudioContextIfNeeded();

      // Note: Animation switching is now handled by the animation controller via handleAudioStart()
      // which is called from the socket store before speakFromBuffer is invoked
      console.log(
        '[Model] Starting speech - animation already handled by controller'
      );

      await new Promise<void>((resolve) => {
        // Check if volume is 0 (muted) - skip audio playback but keep animations
        const currentVolume = this.getVolume();
        if (currentVolume === 0) {
          console.log(
            '[Model] Volume is 0, skipping audio playback and lip sync, but keeping animations'
          );

          // Decode audio to get duration for animation timing
          this.initAudioContextIfNeeded();
          if (this._audioContext) {
            this._audioContext
              .decodeAudioData(audio.slice(0))
              .then((audioBuffer) => {
                const duration = audioBuffer.duration * 1000; // Convert to ms
                console.log(
                  `[Model] Estimated speech duration: ${duration}ms (muted)`
                );

                // Keep isSpeaking true during the estimated duration
                setTimeout(() => {
                  console.log('[Model] Muted speech duration completed');
                  this._speechFinished = true;
                  this.isSpeaking = false;
                  if (this.onSpeechEnd) this.onSpeechEnd();
                  resolve();
                }, duration);
              })
              .catch((error) => {
                console.error(
                  '[Model] Failed to decode audio for duration estimation:',
                  error
                );
                // Fallback: use a default duration (2 seconds)
                setTimeout(() => {
                  this._speechFinished = true;
                  this.isSpeaking = false;
                  if (this.onSpeechEnd) this.onSpeechEnd();
                  resolve();
                }, 2000);
              });
          } else {
            // Fallback if audio context not available
            setTimeout(() => {
              this._speechFinished = true;
              this.isSpeaking = false;
              if (this.onSpeechEnd) this.onSpeechEnd();
              resolve();
            }, 2000);
          }
          return;
        }

        if (this._lipSync) {
          this._lipSync.playFromArrayBuffer(audio, () => {
            console.log('[Model] Speech audio finished');
            this._speechFinished = true;

            const states = {
              hasActionAnimation: !!this.actionAnimation,
              actionIsLooping: this.actionAnimation?.loop === THREE.LoopRepeat,
              animationFinished: this._animationFinished,
              pendingIdleTransition: this._pendingIdleTransition,
            };
            console.log('[Model] Speech end states:', states);

            // TEMPORARILY DISABLED: Animation stopping when speech ends
            // Stop the looping talk animation
            // if (
            //   this.actionAnimation &&
            //   this.actionAnimation.loop === THREE.LoopRepeat
            // ) {
            //   console.log('[Model] Stopping looping talk animation');
            //   this.stopActionAnimation();
            // } else if (this._animationFinished || this._pendingIdleTransition) {
            //   console.log(
            //     '[Model] Animation already finished or pending, stopping'
            //   );
            //   this._pendingIdleTransition = false;
            //   this.stopActionAnimation();
            // } else {
            //   console.log('[Model] Marking pending idle transition');
            //   this._pendingIdleTransition = true;
            // }

            this.isSpeaking = false;

            // Note: Animation switching is now handled at the audio queue level
            // to ensure smooth transitions only when all audio is finished

            if (this.onSpeechEnd) this.onSpeechEnd();
            resolve();
          });
        } else {
          this.isSpeaking = false;

          // Note: Animation switching is now handled at the audio queue level
          // to ensure smooth transitions only when all audio is finished

          resolve();
        }
      });
    } catch (error) {
      console.error('[Model] speakFromBuffer error:', error);
      this.isSpeaking = false;
      if (this.onSpeechEnd) this.onSpeechEnd();
    }
    console.log('[Model] ============ SPEAK FROM BUFFER END ============');
  }

  /**
   * Generic "speak" with optional screenplay and a known action animation ID
   */
  public async speak({
    buffer,
    screenplay,
    actionAnimationId: _actionAnimationId,
    options: _options,
  }: {
    buffer: ArrayBuffer;
    screenplay: Screenplay | null;
    actionAnimationId?: number;
    options?: AnimationOptions;
  }) {
    if (screenplay) {
      this.emoteController?.playEmotion(screenplay.expression);
    }
    // TEMPORARILY DISABLED: Action animation triggering in speak method
    // if (actionAnimationId) {
    //   await useVRMStore
    //     .getState()
    //     .playActionAnimationById(actionAnimationId, options);
    // }
    await new Promise<void>((resolve) => {
      this._lipSync?.playFromArrayBuffer(buffer, () => {
        console.log('[Model] Speech finished in speak()');
        this._speechFinished = true;
        // TEMPORARILY DISABLED: Animation stopping when speech finishes
        // if (this._animationFinished || this._pendingIdleTransition) {
        //   this._pendingIdleTransition = false;
        //   this.stopActionAnimation();
        // } else {
        //   this._pendingIdleTransition = true;
        // }
        resolve();
      });
    });
  }

  public cancelSpeech() {
    if (this.isSpeaking) {
      this._lipSync?.stop();
      this.stopActionAnimation();
      this.isSpeaking = false;
      this.onSpeechEnd?.();
    }
  }

  public stopSpeaking() {
    this.cancelSpeech();

    this._speechFinished = true;
    this._animationFinished = true;
    this._pendingIdleTransition = false;

    if (this.actionAnimation) {
      this.stopActionAnimation();
    }

    if (this.loopListener && this.mixer) {
      this.mixer.removeEventListener('loop', this.loopListener);
      this.loopListener = undefined;
    }
  }

  // Add volume control methods
  public setVolume(volume: number) {
    this.initAudioContextIfNeeded();
    if (this._gainNode) {
      console.log(`Setting volume to: ${volume}`);
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this._gainNode.gain.value = clampedVolume;

      // Connect/disconnect from destination based on volume
      const audioContext = this._gainNode.context;
      if (clampedVolume > 0) {
        // Connect to destination if not already connected
        try {
          this._gainNode.connect(audioContext.destination);
        } catch {
          // Already connected, ignore error
        }
      } else {
        // Disconnect from destination when muted
        try {
          this._gainNode.disconnect(audioContext.destination);
        } catch {
          // Not connected, ignore error
        }
      }
    } else {
      console.warn('No gain node available to set volume');
    }
  }

  public getVolume(): number {
    return this._gainNode?.gain.value ?? 1;
  }

  // Add method to adjust lip sync sensitivity
  public setLipSyncSensitivity(factor: number) {
    if (this._lipSync) {
      this._lipSync.setSmoothingFactor(factor);
      console.log(`[Model] Set lip sync smoothing factor to: ${factor}`);
    }
  }

  /**
   * Get the analyser node from the lip sync instance for audio visualization
   */
  public getLipSyncAnalyser(): AnalyserNode | null {
    return this._lipSync?.analyser || null;
  }

  /**
   * Check if the agent is currently speaking
   */
  public isAgentSpeaking(): boolean {
    return this.isSpeaking;
  }

  private startDebugLogging() {
    // Log animation states every 500ms
    this._debugInterval = setInterval(() => {
      this.logAnimationState();
    }, 500);
  }

  private stopDebugLogging() {
    if (this._debugInterval) {
      clearInterval(this._debugInterval);
      this._debugInterval = undefined;
    }
  }

  private stopLipSyncDebugLogging() {
    this._enableLipSyncDebug = false;
    if (this._lipSyncDebugInterval) {
      clearInterval(this._lipSyncDebugInterval);
      this._lipSyncDebugInterval = undefined;
    }
  }

  private logAnimationState() {
    const state = {
      hasIdleAnimation: !!this.idleAnimation,
      idleIsRunning: this.idleAnimation?.isRunning() || false,
      idleWeight: this.idleAnimation?.getEffectiveWeight() || 0,
      idleTime: this.idleAnimation?.time || 0,
      idleEnabled: this.idleAnimation?.enabled || false,
      hasActionAnimation: !!this.actionAnimation,
      actionIsRunning: this.actionAnimation?.isRunning() || false,
      actionWeight: this.actionAnimation?.getEffectiveWeight() || 0,
      actionTime: this.actionAnimation?.time || 0,
      actionEnabled: this.actionAnimation?.enabled || false,
      actionLoop: this.actionAnimation?.loop || 'N/A',
      isSpeaking: this.isSpeaking,
      speechFinished: this._speechFinished,
      animationFinished: this._animationFinished,
      pendingIdleTransition: this._pendingIdleTransition,
    };

    const stateString = JSON.stringify(state, null, 2);
    if (this._lastAnimationStateLog !== stateString) {
      this._lastAnimationStateLog = stateString;
      console.log('[Model] Animation State:', state);

      // Check for potential T-pose conditions
      if (!state.idleIsRunning && !state.actionIsRunning) {
        console.warn(
          '[Model] WARNING: No animations running - potential T-pose!'
        );
      }
      if (
        state.hasIdleAnimation &&
        state.idleWeight === 0 &&
        !state.actionIsRunning
      ) {
        console.warn(
          '[Model] WARNING: Idle exists but has 0 weight with no action - potential T-pose!'
        );
      }
      if (
        state.hasActionAnimation &&
        state.actionWeight === 0 &&
        !state.idleIsRunning
      ) {
        console.warn(
          '[Model] WARNING: Action exists but has 0 weight with no idle - potential T-pose!'
        );
      }
    }
  }

  private initAudioContextIfNeeded() {
    if (!this._audioContext) {
      this._audioContext = getAudioContext();
      this._gainNode = this._audioContext.createGain();

      // Get the current volume from the store and set it
      const currentVolume = useSocketChatStore.getState().volume;
      this._gainNode.gain.value = currentVolume;

      // Only connect to destination if volume > 0
      if (currentVolume > 0) {
        this._gainNode.connect(this._audioContext.destination);
      }

      this._lipSync = new LipSync(this._audioContext, this._gainNode);
    }
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
  }
}

import * as THREE from 'three';

import { AnimationLibrary } from '@/types/vrmTypes';

type TalkingState = 'talking_anim' | 'idle_between' | 'selecting_next';

export class VRMEnhancedAnimationController {
  private mixer: THREE.AnimationMixer;
  private animations: AnimationLibrary;
  private currentAction: THREE.AnimationAction | null = null;
  private previousAction: THREE.AnimationAction | null = null;

  private mainState: 'idle' | 'waiting' | 'talking' = 'idle';
  private idleLoopCount: number = 0;
  private targetIdleLoops: number = 2;
  private talkingState: TalkingState = 'talking_anim';
  private currentEmotion: string = 'neutral';
  private isTalkingActive: boolean = false;
  private pendingEmotionChange: string | null = null;
  private pendingPreferredClip: string | null = null;

  private transitionDuration: number = 0.8; // Reduced for snappier feel
  private _isTransitioning: boolean = false;
  private transitionProgress: number = 0;
  private transitionStartTime: number = 0;
  private fromAction: THREE.AnimationAction | null = null;
  private toAction: THREE.AnimationAction | null = null;
  private currentEasing: (t: number) => number = this.easeInOutCubic;

  private loopListeners: Map<THREE.AnimationAction, () => void> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private finishedListeners: Map<THREE.AnimationAction, (e: any) => void> =
    new Map();

  private lastIdleClip: THREE.AnimationClip | null = null;
  private lastWaitingClip: THREE.AnimationClip | null = null;
  private lastTalkingClip: THREE.AnimationClip | null = null;

  private activeActions: Set<THREE.AnimationAction> = new Set();
  private actionsToCleanup: Set<THREE.AnimationAction> = new Set();

  // 🔧 FIX: Add transition lock to prevent race conditions
  private transitionLock: boolean = false;
  private pendingTransition: {
    clip: THREE.AnimationClip;
    loop: boolean;
    easing: string;
  } | null = null;

  constructor(mixer: THREE.AnimationMixer, animationLibrary: AnimationLibrary) {
    this.mixer = mixer;
    this.animations = animationLibrary;
  }

  // ==================== Easing Functions ====================

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  private easeInQuart(t: number): number {
    return t * t * t * t;
  }

  private easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  // ==================== Animation Selection ====================

  private getRandomAnimation(
    clips: THREE.AnimationClip[],
    excludeClip: THREE.AnimationClip | null = null
  ): THREE.AnimationClip | null {
    if (!clips || clips.length === 0) return null;

    const availableClips = excludeClip
      ? clips.filter((clip) => clip !== excludeClip)
      : clips;

    const finalClips = availableClips.length > 0 ? availableClips : clips;

    return finalClips[Math.floor(Math.random() * finalClips.length)];
  }

  private getTalkingAnimationForEmotion(
    emotion: string
  ): THREE.AnimationClip | null {
    const emotionKey = this.mapEmotionToKey(emotion);
    const emotionClips =
      this.animations.talking[
        emotionKey as keyof typeof this.animations.talking
      ];

    if (!emotionClips || emotionClips.length === 0) {
      console.warn(
        `[AnimController] No talking animations for emotion: ${emotion}`
      );
      return null;
    }

    return this.getRandomAnimation(emotionClips, this.lastTalkingClip);
  }

  private mapEmotionToKey(emotion: string): string {
    const emotionMap: Record<string, string> = {
      joy: 'happy',
      happy: 'happy',
      angry: 'angry',
      sad: 'sad',
      sorrow: 'sad',
      neutral: 'neutral',
      relaxed: 'neutral',
    };

    const normalized = emotion.toLowerCase().trim();
    return emotionMap[normalized] || 'neutral';
  }

  // ==================== Action Management ====================

  private stopAllActions(): void {
    console.log(
      `[AnimController] 🛑 Stopping inactive actions (${this.activeActions.size} total active)`
    );

    let stoppedCount = 0;
    this.activeActions.forEach((action) => {
      if (
        action !== this.fromAction &&
        action !== this.toAction &&
        action !== this.currentAction
      ) {
        console.log(
          `[AnimController] 🛑 Stopping action: ${action.getClip().name}`
        );
        this.cleanupActionListeners(action);
        action.setEffectiveWeight(0);
        action.stop();
        this.activeActions.delete(action);
        stoppedCount++;
      }
    });

    console.log(
      `[AnimController] 🛑 Stopped ${stoppedCount} inactive actions, ${this.activeActions.size} still active`
    );
  }

  // ==================== Transition System ====================

  private transitionTo(
    clip: THREE.AnimationClip,
    loop: boolean = true,
    easing: 'easeInOut' | 'easeOut' | 'easeIn' = 'easeInOut',
    forceInterrupt: boolean = false
  ): void {
    if (!clip) {
      console.warn('[AnimController] Attempted to transition to null clip');
      return;
    }

    // 🔧 FIX: If forceInterrupt is true (e.g., for talking animations), break locks
    if (forceInterrupt) {
      if (this.transitionLock) {
        console.log(
          '[AnimController] ⚡ Force interrupting locked transition for:',
          clip.name
        );
        this.transitionLock = false;
        this.pendingTransition = null;
      }
      if (this._isTransitioning) {
        console.log(
          '[AnimController] ⚡ Force interrupting active transition for:',
          clip.name
        );
        this.completeTransitionImmediately();
      }
    } else {
      // 🔧 FIX: Check transition lock and queue if busy (only for non-forced transitions)
      if (this.transitionLock) {
        console.log(
          '[AnimController] ⏸️ Transition locked, queuing:',
          clip.name
        );
        this.pendingTransition = { clip, loop, easing };
        return;
      }

      // 🔧 FIX: If transitioning, complete current transition first
      if (this._isTransitioning) {
        console.log(
          '[AnimController] ⚡ Interrupting transition, completing current first'
        );
        this.completeTransitionImmediately();
      }
    }

    // Lock transitions
    this.transitionLock = true;

    console.log(
      `[AnimController] 🎬 Transitioning to: ${clip.name} (loop: ${loop})`
    );

    // Set easing function
    switch (easing) {
      case 'easeInOut':
        this.currentEasing = this.easeInOutSine;
        break;
      case 'easeOut':
        this.currentEasing = this.easeOutQuart;
        break;
      case 'easeIn':
        this.currentEasing = this.easeInQuart;
        break;
      default:
        this.currentEasing = this.easeInOutSine;
    }

    // Create and prepare new action
    const newAction = this.mixer.clipAction(clip);
    newAction.reset();
    newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    newAction.clampWhenFinished = !loop;
    newAction.enabled = true;
    newAction.setEffectiveTimeScale(1.0);
    newAction.time = 0;

    // 🔧 FIX: Inherit weight from current action for smooth transition
    const startWeight = this.currentAction?.getEffectiveWeight() || 0;
    newAction.setEffectiveWeight(0);

    // Start playing BEFORE setting up transition
    newAction.play();

    // Force mixer update to ensure action is initialized
    this.mixer.update(0);

    this.activeActions.add(newAction);
    this.previousAction = this.currentAction;

    // Setup transition
    if (this.previousAction && startWeight > 0.01) {
      this._isTransitioning = true;
      this.transitionProgress = 0;
      this.transitionStartTime = performance.now();
      this.fromAction = this.previousAction;
      this.toAction = newAction;

      // 🔧 FIX: Ensure from action maintains its weight
      this.fromAction.setEffectiveWeight(startWeight);

      console.log(
        `[AnimController] ↔️ Smooth transition: ${this.fromAction.getClip().name} (${startWeight.toFixed(3)}) → ${clip.name}`
      );
    } else {
      // No smooth transition needed
      console.log('[AnimController] ▶️ Starting immediately at full weight');
      newAction.setEffectiveWeight(1);
      this.transitionLock = false; // Release lock immediately
    }

    this.currentAction = newAction;

    // Setup event listeners
    if (loop) {
      const loopListener = () => this.onAnimationLoop(newAction);
      this.mixer.addEventListener('loop', loopListener);
      this.loopListeners.set(newAction, loopListener);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finishedListener = (e: any) => this.onAnimationFinished(e);
      this.mixer.addEventListener('finished', finishedListener);
      this.finishedListeners.set(newAction, finishedListener);
    }
  }

  // 🔧 NEW: Complete transition immediately (for interruptions)
  private completeTransitionImmediately(): void {
    if (!this._isTransitioning) return;

    console.log('[AnimController] ⚡ Force completing transition');

    if (this.toAction) {
      this.toAction.setEffectiveWeight(1);
    }

    if (this.fromAction) {
      this.fromAction.setEffectiveWeight(0);
      this.actionsToCleanup.add(this.fromAction);
    }

    this._isTransitioning = false;
    this.fromAction = null;
    this.toAction = null;
    this.transitionLock = false;
  }

  // ==================== State Machine ====================

  private startIdleSequence(): void {
    console.log('[AnimController] 🔵 Starting IDLE sequence (target: 2 loops)');
    this.mainState = 'idle';
    this.idleLoopCount = 0;

    const idleClip = this.getRandomAnimation(
      this.animations.idle,
      this.lastIdleClip
    );
    if (idleClip) {
      this.lastIdleClip = idleClip;
      this.transitionTo(idleClip, true, 'easeInOut');
      console.log('[AnimController] ✅ Idle animation set to LOOP');
    } else {
      console.warn('[AnimController] No idle animations available');
    }
  }

  private startWaitingSequence(): void {
    console.log('[AnimController] ⏸️ Starting WAITING sequence (play once)');
    this.mainState = 'waiting';

    const waitingClip = this.getRandomAnimation(
      this.animations.waiting,
      this.lastWaitingClip
    );
    if (waitingClip) {
      this.lastWaitingClip = waitingClip;
      this.transitionTo(waitingClip, false, 'easeInOut');
    } else {
      console.warn('[AnimController] No waiting animations available');
      this.startIdleSequence();
    }
  }

  private startTalkingSequence(emotion: string, preferredClip?: string): void {
    console.log(
      `[AnimController] 🎤 Starting TALKING sequence (emotion: ${emotion}${
        preferredClip ? `, preferred: ${preferredClip}` : ''
      })`
    );
    this.mainState = 'talking';
    this.talkingState = 'talking_anim';
    this.currentEmotion = emotion;
    this.isTalkingActive = true;
    this.pendingEmotionChange = null;

    const preferred = preferredClip || this.pendingPreferredClip || undefined;
    let talkingClip: THREE.AnimationClip | null = null;

    if (preferred) {
      console.log(
        `[AnimController] 🎯 Trying preferred clip first: "${preferred}"`
      );
      talkingClip = this.findClipByName(preferred);
      if (!talkingClip) {
        console.warn(
          `[AnimController] ⚠️ Preferred clip not found, falling back to emotion pool`
        );
      }
    }

    if (!talkingClip) {
      console.log(
        `[AnimController] 🎲 Selecting random clip from emotion pool: ${emotion}`
      );
      talkingClip = this.getTalkingAnimationForEmotion(emotion);
    }

    this.pendingPreferredClip = null;

    if (talkingClip) {
      console.log(
        `[AnimController] ✅ Selected talking clip: "${talkingClip.name}"`
      );
      this.lastTalkingClip = talkingClip;
      // 🔧 FIX: Force interrupt any ongoing transitions when starting to talk
      this.transitionTo(talkingClip, false, 'easeInOut', true);
    } else {
      console.warn(
        '[AnimController] ❌ No talking animations available - stopping talking'
      );
      this.stopTalking();
    }
  }

  private playIdleBetweenTalking(): void {
    console.log('[AnimController] 🔄 Playing IDLE between talking animations');
    this.talkingState = 'idle_between';

    const idleClip = this.getRandomAnimation(
      this.animations.idle,
      this.lastIdleClip
    );
    if (idleClip) {
      this.lastIdleClip = idleClip;
      this.transitionTo(idleClip, false, 'easeInOut');
      console.log('[AnimController] ✅ Idle between talking set to ONE-SHOT');
    } else {
      setTimeout(() => {
        this.selectNextTalkingAnimation();
      }, 50);
    }
  }

  private selectNextTalkingAnimation(): void {
    console.log('[AnimController] 🎯 Selecting next TALKING animation');
    this.talkingState = 'selecting_next';

    if (this.pendingEmotionChange) {
      console.log(
        `[AnimController] 🔥 New emotion from chunk: ${this.pendingEmotionChange}`
      );
      this.currentEmotion = this.pendingEmotionChange;
      this.pendingEmotionChange = null;
    }

    setTimeout(() => {
      let talkingClip: THREE.AnimationClip | null = null;
      if (this.pendingPreferredClip) {
        talkingClip = this.findClipByName(this.pendingPreferredClip);
        if (!talkingClip) {
          console.warn(
            '[AnimController] Preferred clip not found:',
            this.pendingPreferredClip
          );
        }
        this.pendingPreferredClip = null;
      }

      if (!talkingClip) {
        talkingClip = this.getTalkingAnimationForEmotion(this.currentEmotion);
      }

      if (talkingClip) {
        this.lastTalkingClip = talkingClip;
        this.talkingState = 'talking_anim';
        this.transitionTo(talkingClip, false, 'easeInOut');
      } else {
        this.playIdleBetweenTalking();
      }
    }, 75);
  }

  private findClipByName(name: string): THREE.AnimationClip | null {
    if (!name) return null;
    const target = this.sanitizeName(name);
    console.log(
      `[AnimController] 🔍 Looking for clip: "${name}" (sanitized: "${target}")`
    );

    const searchList: THREE.AnimationClip[] = [
      ...this.animations.idle,
      ...this.animations.waiting,
      ...this.animations.talking.happy,
      ...this.animations.talking.neutral,
      ...this.animations.talking.angry,
      ...this.animations.talking.sad,
    ];

    const found = searchList.find(
      (clip) => this.sanitizeName(clip.name) === target
    );

    if (found) {
      console.log(
        `[AnimController] ✅ Found clip: "${found.name}" (sanitized: "${this.sanitizeName(found.name)}")`
      );
    } else {
      console.warn(
        `[AnimController] ❌ Clip not found: "${name}". Available clips:`,
        searchList.map((c) => c.name).slice(0, 10) // Show first 10 for debugging
      );
    }

    return found || null;
  }

  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[\s_-]/g, '');
  }

  private stopTalking(): void {
    console.log(
      '[AnimController] 🔇 STOPPING talking, returning to idle/waiting loop'
    );
    this.isTalkingActive = false;
    this.pendingEmotionChange = null;
    this.startIdleSequence();
  }

  // ==================== Event Handlers ====================

  private onAnimationLoop(action: THREE.AnimationAction): void {
    if (action !== this.currentAction) return;

    console.log(`[AnimController] 🔁 Loop: ${action.getClip().name}`);

    if (this.mainState === 'idle' && !this.isTalkingActive) {
      this.idleLoopCount++;
      console.log(
        `[AnimController] Idle loop ${this.idleLoopCount}/${this.targetIdleLoops}`
      );

      if (this.idleLoopCount >= this.targetIdleLoops) {
        this.startWaitingSequence();
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onAnimationFinished(event: any): void {
    if (!event || !event.action) return;

    const action = event.action;
    if (action !== this.currentAction) return;

    console.log(`[AnimController] ✅ Finished: ${action.getClip().name}`);

    // 🔧 FIX: Maintain weight at 1.0 until transition starts
    action.setEffectiveWeight(1.0);

    if (this.mainState === 'waiting') {
      this.startIdleSequence();
    } else if (this.mainState === 'talking' && this.isTalkingActive) {
      if (this.talkingState === 'talking_anim') {
        this.playIdleBetweenTalking();
      } else if (this.talkingState === 'idle_between') {
        this.selectNextTalkingAnimation();
      }
    } else if (this.mainState === 'talking' && !this.isTalkingActive) {
      this.startIdleSequence();
    }
  }

  private cleanupActionListeners(action: THREE.AnimationAction): void {
    const loopListener = this.loopListeners.get(action);
    if (loopListener) {
      this.mixer.removeEventListener('loop', loopListener);
      this.loopListeners.delete(action);
    }

    const finishedListener = this.finishedListeners.get(action);
    if (finishedListener) {
      this.mixer.removeEventListener('finished', finishedListener);
      this.finishedListeners.delete(action);
    }
  }

  // ==================== Public API ====================

  public isTransitioning(): boolean {
    return this._isTransitioning;
  }

  public start(): void {
    console.log('[AnimController] 🚀 Starting animation system');
    this.startIdleSequence();
  }

  public onAudioStart(
    emotion: string = 'neutral',
    preferredClip?: string
  ): void {
    console.log(
      `[AnimController] 🎤 Audio START (emotion: ${emotion}${
        preferredClip ? `, preferred: ${preferredClip}` : ''
      })`
    );

    // 🔧 FIX: If already talking with same emotion, just update if different
    if (
      this.isTalkingActive &&
      this.mainState === 'talking' &&
      this.talkingState === 'talking_anim'
    ) {
      if (this.currentEmotion !== emotion) {
        console.log(
          `[AnimController] Already talking, updating emotion: ${this.currentEmotion} → ${emotion}`
        );
        this.pendingEmotionChange = emotion;
      }
      if (preferredClip) {
        console.log(
          `[AnimController] Applying preferred clip while already talking: ${preferredClip}`
        );
        this.pendingPreferredClip = preferredClip;
      }
      return;
    }

    // 🔧 FIX: If transitioning or locked, interrupt to start talking immediately
    if (this._isTransitioning || this.transitionLock) {
      console.log(
        `[AnimController] ⚡ Interrupting transition/lock to start talking immediately`
      );
      this.completeTransitionImmediately();
      this.transitionLock = false;
    }

    if (this.isTalkingActive) {
      console.log(
        `[AnimController] Already talking, queuing emotion: ${emotion}`
      );
      this.pendingEmotionChange = emotion;
      if (preferredClip) {
        this.pendingPreferredClip = preferredClip;
      }
    } else {
      this.startTalkingSequence(emotion, preferredClip);
    }
  }

  public onAudioEnd(): void {
    console.log('[AnimController] 🔇 Audio END');
    this.stopTalking();
  }

  public onEmotionChange(emotion: string): void {
    console.log(`[AnimController] 🔥 New EMOTION from chunk: ${emotion}`);

    if (!this.isTalkingActive) {
      console.log('[AnimController] Not talking, ignoring emotion change');
      return;
    }

    this.pendingEmotionChange = emotion;

    if (this.talkingState === 'idle_between' && this.currentAction) {
      console.log(
        '[AnimController] 🔥 Interrupting idle to play new emotion immediately'
      );
      this.currentEmotion = emotion;
      this.pendingEmotionChange = null;

      const talkingClip = this.getTalkingAnimationForEmotion(emotion);
      if (talkingClip) {
        this.lastTalkingClip = talkingClip;
        this.talkingState = 'talking_anim';
        this.transitionTo(talkingClip, false, 'easeInOut');
      }
    }
  }

  public update(deltaTime: number): void {
    // Cap delta time
    deltaTime = Math.min(deltaTime, 0.1);

    // Phase 1: Clean up actions
    if (this.actionsToCleanup.size > 0) {
      const actionsToRemove: THREE.AnimationAction[] = [];

      this.actionsToCleanup.forEach((action) => {
        if (action.getEffectiveWeight() <= 0.01) {
          console.log(
            `[AnimController] 🧹 Cleaning up: ${action.getClip().name}`
          );
          this.cleanupActionListeners(action);
          action.stop();
          this.activeActions.delete(action);
          actionsToRemove.push(action);
        }
      });

      actionsToRemove.forEach((action) => {
        this.actionsToCleanup.delete(action);
      });
    }

    // Phase 2: Handle transitions
    if (this._isTransitioning && this.fromAction && this.toAction) {
      const elapsed = performance.now() - this.transitionStartTime;
      this.transitionProgress = Math.min(
        elapsed / (this.transitionDuration * 1000),
        1
      );

      if (this.transitionProgress >= 1) {
        // Transition complete
        this._isTransitioning = false;

        this.toAction.setEffectiveWeight(1);

        if (this.fromAction) {
          console.log(
            `[AnimController] Transition complete, scheduling cleanup: ${this.fromAction.getClip().name}`
          );
          this.fromAction.setEffectiveWeight(0);
          this.actionsToCleanup.add(this.fromAction);
        }

        this.fromAction = null;
        this.toAction = null;

        // 🔧 FIX: Release lock and process pending transition
        this.transitionLock = false;

        if (this.pendingTransition) {
          console.log('[AnimController] ⏩ Processing pending transition');
          const pending = this.pendingTransition;
          this.pendingTransition = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.transitionTo(pending.clip, pending.loop, pending.easing as any);
        }

        console.log('[AnimController] ✅ Transition complete');
      } else {
        // Apply easing
        const t = this.currentEasing(this.transitionProgress);

        if (this.fromAction) {
          const fromWeight = Math.max(0, 1 - t);
          this.fromAction.setEffectiveWeight(fromWeight);
        }
        if (this.toAction) {
          const toWeight = Math.min(1, t);
          this.toAction.setEffectiveWeight(toWeight);
        }
      }
    }

    // Phase 3: Update mixer
    this.mixer.update(deltaTime);
  }

  public dispose(): void {
    console.log('[AnimController] 🧹 Disposing controller');

    this.completeTransitionImmediately();

    this.activeActions.forEach((action) => {
      this.cleanupActionListeners(action);
      action.stop();
    });

    this.activeActions.clear();
    this.actionsToCleanup.clear();
    this.loopListeners.clear();
    this.finishedListeners.clear();

    this.currentAction = null;
    this.previousAction = null;
    this.transitionLock = false;
    this.pendingTransition = null;
  }

  public getState(): object {
    return {
      mainState: this.mainState,
      talkingState: this.talkingState,
      isTalkingActive: this.isTalkingActive,
      currentEmotion: this.currentEmotion,
      pendingEmotion: this.pendingEmotionChange,
      idleLoopCount: this.idleLoopCount,
      isTransitioning: this._isTransitioning,
      transitionLocked: this.transitionLock,
      hasPendingTransition: !!this.pendingTransition,
      transitionProgress: this.transitionProgress.toFixed(2),
      currentAnimation: this.currentAction?.getClip().name || 'none',
      activeActions: Array.from(this.activeActions).map(
        (a) => a.getClip().name
      ),
      fromWeight: this.fromAction?.getEffectiveWeight().toFixed(3) || 'N/A',
      toWeight: this.toAction?.getEffectiveWeight().toFixed(3) || 'N/A',
      cleanupQueue: this.actionsToCleanup.size,
    };
  }
}

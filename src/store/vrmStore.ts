import { VRM } from '@pixiv/three-vrm';
import { Object3D, Vector3 } from 'three';
import { create } from 'zustand';

import { AnimationLibraryBuilder } from '@/components/vrm/AnimationLibraryBuilder';
import { Model } from '@/components/vrm/Model';
import { loadVRMAnimation } from '@/components/vrm/VRMAnimation/loadVRMAnimation';
import { VRMAnimation } from '@/components/vrm/VRMAnimation/VRMAnimation';
import { VRMEnhancedAnimationController } from '@/components/vrm/VRMEnhancedAnimationController';
import {
  getEmotionAnimationArray,
  getEmotionAnimationName,
  idleAnimations,
  shouldLoopAnimation,
  waitingAnimations,
} from '@/store/vrmAnimation.helpers';
import { IVrmProps, VRMDisplayEnums } from '@/types/agent';
import { AnimationDictItem } from '@/types/vrmTypes';

/**
 * @file This file contains the Zustand store for managing VRM (3D humanoid model) state.
 * It handles the list of available VRMs, the currently loaded VRM instance, its animations,
 * and related loading states.
 */

/**
 * Represents the current animation playback state of the VRM.
 */
export type AnimationState =
  | 'idle' // Default idle state
  | 'talking' // Currently speaking/talking
  | 'waiting' // Waiting for user input
  | 'transitioning' // Between animations
  | 'loading'; // Loading animations

export interface AnimationStateMachine {
  currentState: AnimationState;
  previousState: AnimationState | null;
  isTransitioning: boolean;
  canTransitionTo: (targetState: AnimationState) => boolean;
  transitionTo: (targetState: AnimationState) => void;
}

/**
 * Extends the base VRM type with application-specific properties.
 */
export interface AdditionalVrmProps extends VRM {
  /** A pointer back to the `Model` class instance that manages this VRM. */
  model?: Model;
  /** The calculated 3D world position of the VRM's eyes, used for camera positioning. */
  eyesPosition?: Vector3;
}

/**
 * Options for controlling animation playback, such as looping.
 */
export interface AnimationOptions {
  /** If true, the animation will loop indefinitely. */
  loop?: boolean;
}

/**
 * Defines the state and actions for the VRM store.
 */
interface VRMStoreState {
  /** An array of all VRM models available on the platform. */
  allVrms: IVrmProps[];
  /** An array of VRMs that are available to the current user. */
  userAvailableVrms: IVrmProps[];
  /** The metadata of the VRM model currently selected by the user. */
  selectedVRM: IVrmProps | null;
  /** The fully loaded and instantiated VRM object currently in the 3D scene. */
  currentVRM: (VRM & AdditionalVrmProps) | null;
  /** The loading state for the currently selected VRM model. */
  loadingState: {
    isLoading: boolean;
    progress: number;
  };

  /** A general loading flag for when VRM data is being fetched. */
  isLoadingVrms: boolean;

  /** NEW: Simple animation controller */
  animationController: VRMEnhancedAnimationController | null;

  /** Audio end debounce tracking */
  lastAudioEndTime: number;
  audioEndDebounceMs: number;

  /** Track if currently in talking mode */
  isInTalkingMode: boolean;

  /** Track if currently switching animations to prevent race conditions */
  isSwitchingAnimation: boolean;

  /** Debounce timer for animation switching */
  animationSwitchDebounce: NodeJS.Timeout | null;

  /** Animation state machine */
  animationState: AnimationState;
  animationStateMachine: AnimationStateMachine;

  /** Track the last played animation to prevent repeats */
  lastPlayedAnimation: string | null;

  /** Current emotion for animation selection */
  currentEmotion: string | null;

  /** Queue of animations to play in sequence */
  animationQueue: string[];
  /** Preferred animation name coming from server hints */
  pendingAnimationName: string | null;

  /** Local VRMA animations from public/vrma folder - each item has {id, name, path, loop} */
  animationDictionary: AnimationDictItem[];
  /** A cache for loaded VRMAnimation instances to avoid re-fetching from URLs. The key is the animation ID. */
  loadedAnimations: Record<number, VRMAnimation | null>;
  /** The detected blend shape category of the current VRM (e.g., 'VRM12', 'ARKIT'). */
  blendShapeType: string | null;
  /** A reference to the current VRM's head bone, used for attaching elements like speech bubbles. */
  headBone: Object3D | null;
  /** Avatar visibility state */
  isAvatarVisible: boolean;
  /** VRM display mode from agent defaults */
  vrmDisplayMode: VRMDisplayEnums;
  /** User override for avatar visibility */
  userAvatarOverride: boolean | null;

  /** Actions */
  setAllVrms: (vrms: IVrmProps[]) => void;
  setUserAvailableVrms: (vrms: IVrmProps[]) => void;
  setSelectedVRM: (vrm: IVrmProps) => void;
  setCurrentVRM: (vrm: VRM & AdditionalVrmProps) => void;
  setVRMBlendShapeType: (type: string) => void;
  setHeadBone: (bone: Object3D | null) => void;
  setIsLoadingVrms: (loading: boolean) => void;
  setLoadingState: (state: { isLoading: boolean; progress: number }) => void;
  setAvatarVisibility: (visible: boolean) => void;
  setVrmDisplayMode: (mode: VRMDisplayEnums) => void;
  setPendingAnimation: (name: string | null) => void;

  /**
   * Scans the `public/vrma` directory (via a manifest file) and registers all found `.vrma` files
   * into the animation dictionary.
   */
  loadVRMAAnimations: () => Promise<void>;
  /** A debug utility to log all registered animations to the console. */
  listAnimations: () => void;
  /**
   * Loads and plays an idle animation by its ID.
   * It fetches the animation if not cached and then instructs the current `Model` instance to play it.
   * @param animationId The ID of the animation to play.
   */
  playIdleAnimationById: (animationId: number) => Promise<void>;
  /**
   * Loads and plays a one-shot or looping action animation (e.g., a gesture or talking loop) by its ID.
   * @param animationId The ID of the animation to play.
   * @param options Playback options, such as whether to loop the animation.
   */
  playActionAnimationById: (
    animationId: number,
    options?: AnimationOptions
  ) => Promise<void>;

  /**
   * Get all idle animations
   */
  getIdleAnimations: () => string[];

  /**
   * Get all waiting animations
   */
  getWaitingAnimations: () => string[];

  /**
   * Play a random idle animation
   */
  playRandomIdleAnimation: () => Promise<void>;

  /**
   * Play a random waiting animation
   */
  playRandomWaitingAnimation: () => Promise<void>;

  /**
   * Switch to a new random animation immediately (for continuous variety)
   */
  switchToNewRandomAnimation: (emotion: string) => Promise<void>;

  /**
   * Start animation sequence for an emotion
   */
  startAnimationSequence: (emotion: string) => Promise<void>;

  /**
   * Animation state machine actions
   */
  setAnimationState: (state: AnimationState) => void;
  getAnimationState: () => AnimationState;
  canTransitionToState: (targetState: AnimationState) => boolean;
  transitionToState: (targetState: AnimationState) => void;

  /**
   * Switch to random talking animation while audio is playing
   */
  switchToRandomTalkingAnimation: () => Promise<void>;

  /**
   * End talking sequence and return to idle
   */
  endTalkingSequence: () => void;

  /**
   * NEW: Initialize simple animation controller
   */
  initializeAnimationController: () => Promise<void>;

  /**
   * NEW: Start animation system
   */
  startAnimationSystem: () => void;

  /**
   * NEW: Handle audio start with emotion
   */
  handleAudioStart: (emotion?: string) => void;

  /**
   * NEW: Handle audio end
   */
  handleAudioEnd: () => void;

  /**
   * NEW: Update animation controller (call in render loop)
   */
  updateAnimationController: (deltaTime: number) => void;
}

/**
 * Zustand store for managing VRM (3D character) state.
 * @see {@link VRMStoreState}
 */
export const useVRMStore = create<VRMStoreState>((set, get) => ({
  allVrms: [],
  userAvailableVrms: [],
  selectedVRM: null,
  currentVRM: null,
  loadingState: {
    isLoading: true,
    progress: 0,
  },

  isLoadingVrms: false,
  animationController: null,

  /** Audio end debounce tracking */
  lastAudioEndTime: 0,
  audioEndDebounceMs: 500, // 500ms debounce

  isInTalkingMode: false,
  isSwitchingAnimation: false,
  animationSwitchDebounce: null,
  animationState: 'idle',
  animationStateMachine: {
    currentState: 'idle',
    previousState: null,
    isTransitioning: false,
    canTransitionTo: (targetState: AnimationState) => {
      const { animationState } = get();
      // Define valid transitions
      const validTransitions: Record<AnimationState, AnimationState[]> = {
        idle: ['talking', 'waiting', 'transitioning'],
        talking: ['idle', 'transitioning'],
        waiting: ['idle', 'talking', 'transitioning'],
        transitioning: ['idle', 'talking', 'waiting'],
        loading: ['idle', 'talking', 'waiting'],
      };
      return validTransitions[animationState]?.includes(targetState) || false;
    },
    transitionTo: (targetState: AnimationState) => {
      const { animationStateMachine } = get();
      if (animationStateMachine.canTransitionTo(targetState)) {
        set({
          animationState: targetState,
          animationStateMachine: {
            ...animationStateMachine,
            previousState: animationStateMachine.currentState,
            currentState: targetState,
            isTransitioning: true,
          },
        });
        // Reset transitioning flag after a short delay
        setTimeout(() => {
          set((state) => ({
            animationStateMachine: {
              ...state.animationStateMachine,
              isTransitioning: false,
            },
          }));
        }, 100);
      } else {
        console.warn(
          `[AnimationStateMachine] ❌ Invalid transition: ${animationStateMachine.currentState} → ${targetState}`
        );
      }
    },
  },
  lastPlayedAnimation: null,
  currentEmotion: null,
  animationQueue: [],

  animationDictionary: [],
  loadedAnimations: {},

  blendShapeType: null,
  headBone: null,
  isAvatarVisible: true,
  vrmDisplayMode: VRMDisplayEnums.VRM,
  userAvatarOverride: null,
  pendingAnimationName: null,
  setAllVrms: (vrms: IVrmProps[]) => set({ allVrms: vrms }),
  setUserAvailableVrms: (vrms: IVrmProps[]) => set({ userAvailableVrms: vrms }),
  setSelectedVRM: (vrm: IVrmProps) => set({ selectedVRM: vrm }),
  setCurrentVRM: (vrm: VRM & AdditionalVrmProps) => set({ currentVRM: vrm }),
  setVRMBlendShapeType: (type) => set({ blendShapeType: type }),
  setHeadBone: (bone) => set({ headBone: bone }),
  setIsLoadingVrms: (loading) => set({ isLoadingVrms: loading }),
  setAvatarVisibility: (visible) => set({ isAvatarVisible: visible }),
  setVrmDisplayMode: (mode) => set({ vrmDisplayMode: mode }),
  setPendingAnimation: (name) => {
    set({ pendingAnimationName: name });
  },

  loadVRMAAnimations: async () => {
    try {
      // Fetch the list of VRMA filenames
      const response = await fetch('/vrma/vrma_filenames.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch VRMA filenames: ${response.status}`);
      }

      const filenames: string[] = await response.json();
      // Create animation dictionary items
      const vrmaAnimations: AnimationDictItem[] = filenames.map(
        (filename, index) => {
          const name = filename.replace('.vrma', '');
          const path = `/vrma/${filename}`;
          const loop = shouldLoopAnimation(filename);

          return {
            id: index + 1000, // Start from 1000 to avoid conflicts with existing animations
            name,
            path,
            loop,
          };
        }
      );

      // Use only local VRMA animations (no API animations)
      set({ animationDictionary: vrmaAnimations });

      // Debug: List all animations
      setTimeout(() => {
        get().listAnimations();
      }, 100);
    } catch (error) {
      console.error('[useVRMStore] Error loading VRMA animations:', error);
    }
  },

  listAnimations: () => {
    const { animationDictionary } = get();
    animationDictionary.forEach((_anim, _index) => {});
  },

  async playIdleAnimationById(animationId: number) {
    const { currentVRM, animationDictionary, loadedAnimations } = get();
    if (!currentVRM || !currentVRM.model) return;
    // 1) find the dictionary entry
    const animEntry = animationDictionary.find((a) => a.id === animationId);
    if (!animEntry) {
      console.warn(
        '[useVRMStore] No animation dictionary entry found for',
        animationId
      );
      return;
    }

    // 2) If we don't have it cached, load it
    let vrmAnim = loadedAnimations[animationId] || null;
    if (!vrmAnim) {
      try {
        const loaded = await loadVRMAnimation(animEntry.path);
        if (!loaded) {
          console.warn(
            '[useVRMStore] Could not load VRMAnimation from path',
            animEntry.path
          );
          return;
        }
        vrmAnim = loaded;
        // Store the animation ID on the VRMAnimation object for tracking
        (vrmAnim as VRMAnimation & { __animationId: number }).__animationId =
          animationId;

        set((state) => ({
          loadedAnimations: {
            ...state.loadedAnimations,
            [animationId]: vrmAnim!,
          },
        }));
      } catch (e) {
        console.error('[useVRMStore] Error loading VRMAnimation', e);
        return;
      }
    }
    // 3) pass to model
    currentVRM.model.loadIdleAnimation(vrmAnim as VRMAnimation);
  },

  async playActionAnimationById(
    animationId: number,
    options?: AnimationOptions
  ) {
    const { currentVRM, animationDictionary, loadedAnimations } = get();
    if (!currentVRM || !currentVRM.model) {
      return;
    }

    // 1) find the dictionary entry
    const animEntry = animationDictionary.find((a) => a.id === animationId);
    if (!animEntry) {
      console.warn(
        '[useVRMStore] ❌ No animation dictionary entry found for',
        animationId
      );
      return;
    }

    // 2) If we don't have it cached, load it
    let vrmAnim = loadedAnimations[animationId] || null;
    if (!vrmAnim) {
      try {
        const loaded = await loadVRMAnimation(animEntry.path);
        if (!loaded) {
          console.warn(
            '[useVRMStore] ❌ Could not load VRMAnimation from path',
            animEntry.path
          );
          return;
        }
        vrmAnim = loaded; // Store the animation ID on the VRMAnimation object for tracking
        (vrmAnim as VRMAnimation & { __animationId: number }).__animationId =
          animationId;

        set((state) => ({
          loadedAnimations: {
            ...state.loadedAnimations,
            [animationId]: vrmAnim!,
          },
        }));
      } catch (e) {
        console.error('[useVRMStore] Error loading VRMAnimation', e);
        return;
      }
    }

    // 3) pass to model
    await currentVRM.model.playActionAnimation(
      vrmAnim as VRMAnimation,
      options
    );
  },

  getIdleAnimations: () => idleAnimations,

  getWaitingAnimations: () => waitingAnimations,

  playRandomIdleAnimation: async () => {
    const { currentVRM, animationDictionary } = get();
    if (!currentVRM || !currentVRM.model) return;

    // Get a random idle animation
    const randomIndex = Math.floor(Math.random() * idleAnimations.length);
    const selectedAnimation = idleAnimations[randomIndex];

    // Find the animation in the dictionary
    const idleAnimation = animationDictionary.find(
      (a) =>
        a.name.toLowerCase().includes(selectedAnimation.toLowerCase()) && a.loop
    );

    if (idleAnimation) {
      await get().playIdleAnimationById(idleAnimation.id);
    } else {
      const fallbackAnimation = animationDictionary.find(
        (a) => a.name.toLowerCase().includes('idle_2') && a.loop
      );
      if (fallbackAnimation) {
        await get().playIdleAnimationById(fallbackAnimation.id);
      }
    }
  },

  playRandomWaitingAnimation: async () => {
    const { currentVRM, animationDictionary } = get();
    if (!currentVRM || !currentVRM.model) return;

    // Get a random waiting animation
    const randomIndex = Math.floor(Math.random() * waitingAnimations.length);
    const selectedAnimation = waitingAnimations[randomIndex];

    // Find the animation in the dictionary
    const waitingAnimation = animationDictionary.find(
      (a) =>
        a.name.toLowerCase().includes(selectedAnimation.toLowerCase()) && a.loop
    );

    if (waitingAnimation) {
      await get().playIdleAnimationById(waitingAnimation.id);
    } else {
      const fallbackAnimation = animationDictionary.find(
        (a) => a.name.toLowerCase().includes('idle_waiting') && a.loop
      );
      if (fallbackAnimation) {
        await get().playIdleAnimationById(fallbackAnimation.id);
      }
    }
  },

  switchToNewRandomAnimation: async (emotion: string) => {
    const {
      currentVRM,
      animationDictionary,
      lastPlayedAnimation,
      isInTalkingMode,
    } = get();
    if (!currentVRM || !currentVRM.model || !isInTalkingMode) return;

    // Get a new random animation for the emotion (avoiding the last played one)
    const emotionAnimationName = getEmotionAnimationName(
      emotion,
      lastPlayedAnimation
    );
    // Find the emotion-based talking animation
    const emotionAnimation = animationDictionary.find(
      (a) => a.name.toLowerCase().includes(emotionAnimationName) && a.loop
    );

    if (emotionAnimation) {
      // Update the last played animation
      set({ lastPlayedAnimation: emotionAnimationName });

      // Switch to the new animation immediately
      await get().playIdleAnimationById(emotionAnimation.id);
    }
  },

  startAnimationSequence: async (emotion: string) => {
    const { currentVRM } = get();
    if (!currentVRM || !currentVRM.model) {
      return;
    }

    // Set the current emotion and talking mode
    set({
      currentEmotion: emotion,
      isInTalkingMode: true,
    });

    // Get the emotion-based animation array
    const emotionArray = getEmotionAnimationArray(emotion);
    // Select first random talking animation
    const firstAnimation =
      emotionArray[Math.floor(Math.random() * emotionArray.length)];
    // Find the animation in the dictionary
    const animation = get().animationDictionary.find(
      (anim) => anim.name === firstAnimation
    );
    if (animation) {
      // Set up animation completion callback for continuous switching (only once)
      if (currentVRM.model && !currentVRM.model.onAnimationComplete) {
        currentVRM.model.onAnimationComplete = () => {
          const {
            isInTalkingMode,
            isSwitchingAnimation,
            animationSwitchDebounce,
          } = get();

          // Clear any existing debounce timer
          if (animationSwitchDebounce) {
            clearTimeout(animationSwitchDebounce);
          }

          if (isInTalkingMode && !isSwitchingAnimation) {
            // Debounce the animation switch to prevent rapid switching
            const debounceTimer = setTimeout(() => {
              get().switchToRandomTalkingAnimation();
            }, 200); // Increased to 200ms debounce to prevent rapid switching
            set({ animationSwitchDebounce: debounceTimer });
          }
        };
      }

      await get().playActionAnimationById(animation.id, { loop: false });
    }
  },

  switchToRandomTalkingAnimation: async () => {
    const {
      currentVRM,
      currentEmotion,
      isInTalkingMode,
      isSwitchingAnimation,
    } = get();

    if (!currentVRM || !currentVRM.model || !isInTalkingMode) {
      return;
    }

    if (isSwitchingAnimation) {
      return;
    }

    if (!currentEmotion) {
      return;
    }

    // Set flag to prevent race conditions
    set({ isSwitchingAnimation: true });

    // Get the emotion-based animation array
    const emotionArray = getEmotionAnimationArray(currentEmotion);
    // Select random talking animation
    const randomAnimation =
      emotionArray[Math.floor(Math.random() * emotionArray.length)];
    // Find the animation in the dictionary
    const animation = get().animationDictionary.find(
      (anim) => anim.name === randomAnimation
    );
    if (animation) {
      await get().playActionAnimationById(animation.id, { loop: false });

      // Reset flag after animation starts
      set({ isSwitchingAnimation: false });
    } else {
      // Reset flag even if animation not found
      set({ isSwitchingAnimation: false });
    }
  },

  setAnimationState: (state: AnimationState) => {
    set({ animationState: state });
  },

  getAnimationState: () => {
    const { animationState } = get();
    return animationState;
  },

  canTransitionToState: (targetState: AnimationState) => {
    const { animationStateMachine } = get();
    return animationStateMachine.canTransitionTo(targetState);
  },

  transitionToState: (targetState: AnimationState) => {
    const { animationStateMachine } = get();
    animationStateMachine.transitionTo(targetState);
  },

  endTalkingSequence: () => {
    // Clear talking mode and reset state
    const { animationSwitchDebounce } = get();
    if (animationSwitchDebounce) {
      clearTimeout(animationSwitchDebounce);
    }

    set({
      isInTalkingMode: false,
      isSwitchingAnimation: false,
      animationSwitchDebounce: null,
      currentEmotion: null,
      animationQueue: [],
      lastPlayedAnimation: null,
    });

    // Transition back to idle animation
    get().playRandomIdleAnimation();
  },

  setLoadingState: (state) => set({ loadingState: state }),

  // NEW: Simple Animation Controller Methods
  initializeAnimationController: async () => {
    const { currentVRM, animationDictionary, loadedAnimations } = get();

    if (!currentVRM || !currentVRM.model || !currentVRM.model.mixer) {
      console.warn(
        '[useVRMStore] Cannot initialize animation controller - VRM or mixer not ready'
      );
      return;
    }

    try {
      // Build animation library from existing system
      const libraryBuilder = new AnimationLibraryBuilder(
        animationDictionary,
        loadedAnimations,
        currentVRM
      );

      const animationLibrary = await libraryBuilder.buildAnimationLibrary();

      // Create the simple animation controller
      const controller = new VRMEnhancedAnimationController(
        currentVRM.model.mixer,
        animationLibrary
      );

      set({ animationController: controller });
    } catch (error) {
      console.error(
        '[useVRMStore] Error initializing animation controller:',
        error
      );
    }
  },

  startAnimationSystem: () => {
    const { animationController } = get();

    if (!animationController) {
      console.warn(
        '[useVRMStore] Cannot start animation system - controller not initialized'
      );
      return;
    }
    animationController.start();
  },

  handleAudioStart: (emotion?: string) => {
    const { animationController, pendingAnimationName } = get();

    if (!animationController) {
      console.warn(
        '[useVRMStore] Cannot handle audio start - controller not initialized'
      );
      return;
    }
    animationController.onAudioStart(
      emotion || 'neutral',
      pendingAnimationName || undefined
    );
    // Clear pending animation once we've used it
    if (pendingAnimationName) {
      set({ pendingAnimationName: null });
    }
  },

  handleAudioEnd: () => {
    const { animationController, lastAudioEndTime, audioEndDebounceMs } = get();

    if (!animationController) {
      console.warn(
        '[useVRMStore] Cannot handle audio end - controller not initialized'
      );
      return;
    }

    // 🔧 FIX: Debounce audio end to prevent rapid-fire calls
    const now = Date.now();
    if (now - lastAudioEndTime < audioEndDebounceMs) {
      console.warn(
        `[useVRMStore] ⏸️ Audio end called too soon (${now - lastAudioEndTime}ms ago), debouncing`
      );
      return;
    }

    set({ lastAudioEndTime: now });
    animationController.onAudioEnd();
  },

  updateAnimationController: (deltaTime: number) => {
    const { animationController } = get();

    if (!animationController) {
      return;
    }

    animationController.update(deltaTime);
  },
}));

export default useVRMStore;

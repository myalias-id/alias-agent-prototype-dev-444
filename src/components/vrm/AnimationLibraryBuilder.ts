import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';

import { AnimationDictItem, AnimationLibrary } from '@/types/vrmTypes';

import { VRMAnimation } from './VRMAnimation/VRMAnimation';

/**
 * Builds animation library from existing VRM animation dictionary
 */
export class AnimationLibraryBuilder {
  private animationDictionary: AnimationDictItem[];
  private loadedAnimations: Record<number, VRMAnimation | null>;
  private vrm: VRM;

  constructor(
    animationDictionary: AnimationDictItem[],
    loadedAnimations: Record<number, VRMAnimation | null>,
    vrm: VRM
  ) {
    this.animationDictionary = animationDictionary;
    this.loadedAnimations = loadedAnimations;
    this.vrm = vrm;
  }

  /**
   * Build animation library from existing system
   */
  public async buildAnimationLibrary(): Promise<AnimationLibrary> {
    const idleClips: THREE.AnimationClip[] = [];
    const waitingClips: THREE.AnimationClip[] = [];
    const talkingClips: {
      happy: THREE.AnimationClip[];
      neutral: THREE.AnimationClip[];
      angry: THREE.AnimationClip[];
      sad: THREE.AnimationClip[];
    } = {
      happy: [],
      neutral: [],
      angry: [],
      sad: [],
    };

    // Process each animation in the dictionary
    for (const animItem of this.animationDictionary) {
      const clip = await this.createAnimationClip(animItem);
      if (!clip) continue;

      const name = animItem.name.toLowerCase();

      // Categorize animations
      if (name.includes('idle_') && !name.includes('waiting')) {
        // Idle animations (Idle_2, Idle_3, idle_4, etc.)
        idleClips.push(clip);
        console.log('[AnimationLibraryBuilder] Added idle animation:', name);
      } else if (name.includes('idle_waiting') || name.includes('waiting')) {
        // Waiting animations
        waitingClips.push(clip);
        console.log('[AnimationLibraryBuilder] Added waiting animation:', name);
      } else if (
        name.includes('talking_happy') ||
        name.includes('talking_joy') ||
        name.includes('talking_fun')
      ) {
        // Happy talking animations
        talkingClips.happy.push(clip);
        console.log(
          '[AnimationLibraryBuilder] Added happy talking animation:',
          name
        );
      } else if (name.includes('talking_angry')) {
        // Angry talking animations
        talkingClips.angry.push(clip);
        console.log(
          '[AnimationLibraryBuilder] Added angry talking animation:',
          name
        );
      } else if (
        name.includes('talking_sad') ||
        name.includes('talking_sorrow')
      ) {
        // Sad talking animations
        talkingClips.sad.push(clip);
        console.log(
          '[AnimationLibraryBuilder] Added sad talking animation:',
          name
        );
      } else if (name.includes('talking_neutral')) {
        // Neutral talking animations
        talkingClips.neutral.push(clip);
        console.log(
          '[AnimationLibraryBuilder] Added neutral talking animation:',
          name
        );
      }
    }

    // Ensure we have at least one animation in each category
    if (idleClips.length === 0) {
      console.warn('[AnimationLibraryBuilder] No idle animations found');
    }
    if (waitingClips.length === 0) {
      console.warn('[AnimationLibraryBuilder] No waiting animations found');
    }
    if (Object.values(talkingClips).every((arr) => arr.length === 0)) {
      console.warn('[AnimationLibraryBuilder] No talking animations found');
    }

    return {
      idle: idleClips,
      waiting: waitingClips,
      talking: talkingClips,
    };
  }

  /**
   * Create animation clip from animation dictionary item
   */
  private async createAnimationClip(
    animItem: AnimationDictItem
  ): Promise<THREE.AnimationClip | null> {
    try {
      // Check if animation is already loaded
      let vrmAnim = this.loadedAnimations[animItem.id];

      if (!vrmAnim) {
        // Load the animation if not cached
        const { loadVRMAnimation } =
          await import('./VRMAnimation/loadVRMAnimation');
        vrmAnim = await loadVRMAnimation(animItem.path);

        if (!vrmAnim) {
          console.warn(
            `[AnimationLibraryBuilder] Could not load animation: ${animItem.name}`
          );
          return null;
        }
      }

      // Create animation clip from VRMAnimation
      const clip = vrmAnim.createAnimationClip(this.vrm);
      clip.name = animItem.name; // Preserve original name

      return clip;
    } catch (error) {
      console.error(
        `[AnimationLibraryBuilder] Error creating clip for ${animItem.name}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get animation clips by category (for debugging)
   */
  public getAnimationClipsByCategory(): {
    idle: string[];
    waiting: string[];
    talking: {
      happy: string[];
      neutral: string[];
      angry: string[];
      sad: string[];
    };
  } {
    const idle: string[] = [];
    const waiting: string[] = [];
    const talking: {
      happy: string[];
      neutral: string[];
      angry: string[];
      sad: string[];
    } = {
      happy: [],
      neutral: [],
      angry: [],
      sad: [],
    };

    for (const animItem of this.animationDictionary) {
      const name = animItem.name.toLowerCase();

      if (name.includes('idle_') && !name.includes('waiting')) {
        idle.push(animItem.name);
      } else if (name.includes('idle_waiting') || name.includes('waiting')) {
        waiting.push(animItem.name);
      } else if (name.includes('talking_happy')) {
        talking.happy.push(animItem.name);
      } else if (name.includes('talking_angry')) {
        talking.angry.push(animItem.name);
      } else if (name.includes('talking_sad')) {
        talking.sad.push(animItem.name);
      } else if (name.includes('talking_neutral')) {
        talking.neutral.push(animItem.name);
      }
    }

    return { idle, waiting, talking };
  }
}

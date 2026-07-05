import * as THREE from 'three';

export const enum BlendShapeCategory {
  ARKIT52,
  VRM12,
  INVALID,
}

/**
 * Represents an entry in the animation dictionary, providing metadata for a single animation.
 * Single canonical definition — previously duplicated in vrmStore.ts and AnimationLibraryBuilder.ts.
 */
export interface AnimationDictItem {
  /** A unique identifier for the animation. */
  id: number;
  /** The display name of the animation. */
  name: string;
  /** The URL path to the `.vrma` animation file. */
  path: string;
  /** An optional URL to a thumbnail image for the animation. */
  image?: string;
  /** A flag indicating if the animation should loop by default. */
  loop?: boolean;
}

/**
 * The full library of categorised animation clips loaded for a VRM model.
 * Single canonical definition — previously duplicated in VRMSimpleAnimationController.ts
 * and VRMEnhancedAnimationController.ts.
 */
export interface AnimationLibrary {
  idle: THREE.AnimationClip[];
  waiting: THREE.AnimationClip[];
  talking: {
    happy: THREE.AnimationClip[];
    neutral: THREE.AnimationClip[];
    angry: THREE.AnimationClip[];
    sad: THREE.AnimationClip[];
  };
}

export const VRM12Names = [
  ['A', 'aa', 'a', 'ah'],
  ['I', 'ih', 'i'],
  ['U', 'uh', 'U'],
  ['E', 'eh', 'E'],
  ['O', 'oh', 'o', 'ou'],
  ['Blink', 'blink'],
  ['Blink_L', 'blink_l', 'blink_left', 'eyeblinkleft'],
  ['Blink_R', 'blink_r', 'blink_right', 'eyeblinklight'],
  ['Joy', 'joy', 'happy'],
  ['Sorrow', 'sad', 'sorrow'],
  ['Angry', 'angry'],
  ['Fun', 'fun'],
  ['LookUp', 'lookup', 'look_up', 'eyelookup'],
  ['LookDown', 'lookdown', 'look_down', 'eyelookdown'],
  ['LookLeft', 'lookleft', 'look_left', 'eyelookleft'],
  ['LookRight', 'lookright', 'look_right', 'eyelookright'],
  ['Neutral', 'relaxed', 'neutral'],
];

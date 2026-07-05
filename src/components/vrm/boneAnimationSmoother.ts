/* eslint-disable @typescript-eslint/no-explicit-any */
import { VRM, VRMHumanBoneName, VRMHumanoid } from '@pixiv/three-vrm';
import * as THREE from 'three';

import { AnimationSmoothingConfig } from './animationSmoother';

export interface BoneSmoothingState {
  lastKeyframeTime: number;
  nextKeyframeTime: number;
  currentFrame: number;
  totalFrames: number;
  isInterpolating: boolean;
  // Store previous bone rotations for smoothing
  previousRotations: Map<string, THREE.Quaternion>;
  smoothedRotations: Map<string, THREE.Quaternion>;
}

export class BoneAnimationSmoother {
  private config: AnimationSmoothingConfig;
  private state: BoneSmoothingState;
  private clock: THREE.Clock;
  private frameCount: number = 0;
  private vrm: VRM | null = null;
  private humanoid: VRMHumanoid | null = null;
  private animationMixer: THREE.AnimationMixer | null = null;

  // Target bones for smoothing (focus on arms)
  private targetBones = [
    VRMHumanBoneName.LeftLowerArm,
    VRMHumanBoneName.RightLowerArm,
    VRMHumanBoneName.LeftUpperArm,
    VRMHumanBoneName.RightUpperArm,
    VRMHumanBoneName.LeftHand,
    VRMHumanBoneName.RightHand,
  ];

  constructor(clock: THREE.Clock, config?: Partial<AnimationSmoothingConfig>) {
    this.clock = clock;
    this.config = {
      enabled: true,
      targetFrameRate: 8, // 8 FPS = every 7.5th frame at 60 FPS (more dramatic)
      interpolationMethod: 'smoothstep',
      smoothingStrength: 0.9, // Higher smoothing strength for more noticeable effect
      maxInterpolationFrames: 10,
      ...config,
    };

    this.state = {
      lastKeyframeTime: 0,
      nextKeyframeTime: 0,
      currentFrame: 0,
      totalFrames: 0,
      isInterpolating: false,
      previousRotations: new Map(),
      smoothedRotations: new Map(),
    };
  }

  /**
   * Set the VRM instance to smooth
   */
  public setVRM(vrm: VRM): void {
    this.vrm = vrm;
    this.humanoid = vrm.humanoid;
    this.initializeBoneState();
  }

  /**
   * Set the animation mixer for proper animation control
   */
  public setAnimationMixer(mixer: THREE.AnimationMixer): void {
    this.animationMixer = mixer;
  }

  /**
   * Initialize bone state tracking
   */
  private initializeBoneState(): void {
    if (!this.humanoid) return;

    this.state.previousRotations.clear();
    this.state.smoothedRotations.clear();

    // Initialize target bones
    this.targetBones.forEach((boneName) => {
      const boneNode = this.humanoid!.getNormalizedBoneNode(boneName);
      if (boneNode) {
        const rotation = new THREE.Quaternion();
        boneNode.getWorldQuaternion(rotation);

        this.state.previousRotations.set(boneName, rotation.clone());
        this.state.smoothedRotations.set(boneName, rotation.clone());
      }
    });
  }

  /**
   * Check if we should update bone animations this frame
   */
  public shouldUpdateBones(): boolean {
    this.frameCount++;

    if (!this.config.enabled) {
      return true;
    }

    // Always apply bone smoothing when enabled
    this.applyBoneSmoothing();

    const currentTime = this.clock.getElapsedTime();
    const frameInterval = 1.0 / this.config.targetFrameRate;

    // Check if enough time has passed since last keyframe
    if (currentTime - this.state.lastKeyframeTime >= frameInterval) {
      this.state.lastKeyframeTime = currentTime;
      this.state.nextKeyframeTime = currentTime + frameInterval;
      this.state.currentFrame = 0;
      this.state.totalFrames = Math.ceil(frameInterval * 60);
      this.state.isInterpolating = false;

      // Store current bone states as keyframes
      this.storeBoneKeyframes();

      return true;
    }

    // Mark as interpolating between keyframes
    this.state.isInterpolating = true;
    this.state.currentFrame++;

    return false;
  }

  /**
   * Store current bone states as keyframes
   */
  private storeBoneKeyframes(): void {
    if (!this.humanoid) return;

    this.targetBones.forEach((boneName) => {
      const boneNode = this.humanoid!.getNormalizedBoneNode(boneName);
      if (boneNode) {
        const rotation = new THREE.Quaternion();
        boneNode.getWorldQuaternion(rotation);

        // Store the previous smoothed rotation
        const currentSmoothed = this.state.smoothedRotations.get(boneName);
        if (currentSmoothed) {
          this.state.previousRotations.set(boneName, currentSmoothed.clone());
        }
      }
    });
  }

  /**
   * Apply smoothing to bone animations
   */
  private applyBoneSmoothing(): void {
    if (!this.humanoid || !this.config.enabled) return;

    const factor = this.getInterpolationFactor();
    const smoothingFactor = this.config.smoothingStrength * factor;

    this.targetBones.forEach((boneName) => {
      const boneNode = this.humanoid!.getNormalizedBoneNode(boneName);
      if (boneNode) {
        const previousRotation = this.state.previousRotations.get(boneName);
        const currentSmoothed = this.state.smoothedRotations.get(boneName);

        if (previousRotation && currentSmoothed) {
          // Get current bone rotation
          const currentRotation = new THREE.Quaternion();
          boneNode.getWorldQuaternion(currentRotation);

          // Apply smoothing using exponential moving average
          const smoothedRotation = new THREE.Quaternion();

          // Use different smoothing factors for different bone types
          let boneSmoothingFactor = smoothingFactor;

          if (
            boneName === VRMHumanBoneName.LeftLowerArm ||
            boneName === VRMHumanBoneName.RightLowerArm
          ) {
            // More aggressive smoothing for lower arms to reduce twitchiness
            boneSmoothingFactor = Math.min(0.4, smoothingFactor * 1.8);
          } else if (
            boneName === VRMHumanBoneName.LeftUpperArm ||
            boneName === VRMHumanBoneName.RightUpperArm
          ) {
            // Moderate smoothing for upper arms
            boneSmoothingFactor = Math.min(0.3, smoothingFactor * 1.2);
          } else if (
            boneName === VRMHumanBoneName.LeftHand ||
            boneName === VRMHumanBoneName.RightHand
          ) {
            // Light smoothing for hands
            boneSmoothingFactor = Math.min(0.2, smoothingFactor * 0.8);
          }

          smoothedRotation.slerpQuaternions(
            currentSmoothed, // Previous smoothed value
            currentRotation, // Current raw value
            boneSmoothingFactor
          );

          // Store the smoothed rotation
          this.state.smoothedRotations.set(boneName, smoothedRotation.clone());

          // Apply the smoothed rotation to the bone
          // Use local rotation to avoid affecting the bone hierarchy
          const localRotation = new THREE.Quaternion();
          const parentWorldRotation = new THREE.Quaternion();

          if (boneNode.parent) {
            boneNode.parent.getWorldQuaternion(parentWorldRotation);
            localRotation.copy(smoothedRotation);
            localRotation.premultiply(parentWorldRotation.invert());
          } else {
            localRotation.copy(smoothedRotation);
          }

          boneNode.quaternion.copy(localRotation);
        }
      }
    });
  }

  /**
   * Get interpolation factor between 0 and 1 for smooth transitions
   */
  private getInterpolationFactor(): number {
    if (!this.config.enabled || !this.state.isInterpolating) {
      return 1.0;
    }

    const progress = Math.min(
      1.0,
      this.state.currentFrame / this.state.totalFrames
    );

    switch (this.config.interpolationMethod) {
      case 'linear':
        return progress;

      case 'easeInOut':
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      case 'smoothstep':
        return THREE.MathUtils.smoothstep(0, 1, progress);

      case 'cubic':
        return progress * progress * (3 - 2 * progress);

      default:
        return progress;
    }
  }

  /**
   * Update the configuration
   */
  public updateConfig(newConfig: Partial<AnimationSmoothingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): AnimationSmoothingConfig {
    return { ...this.config };
  }

  /**
   * Get current smoothing state for debugging
   */
  public getState(): BoneSmoothingState {
    return { ...this.state };
  }

  /**
   * Reset the smoothing state
   */
  public reset(): void {
    this.state = {
      lastKeyframeTime: this.clock.getElapsedTime(),
      nextKeyframeTime: 0,
      currentFrame: 0,
      totalFrames: 0,
      isInterpolating: false,
      previousRotations: new Map(),
      smoothedRotations: new Map(),
    };
    this.initializeBoneState();
  }

  /**
   * Get debug information
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDebugInfo(): any {
    return {
      config: this.getConfig(),
      state: this.getState(),
      currentTime: this.clock.getElapsedTime(),
      frameCount: this.frameCount,
      isInterpolating: this.state.isInterpolating,
      interpolationFactor: this.getInterpolationFactor(),
      hasAnimationMixer: !!this.animationMixer,
      targetBones: this.targetBones,
      boneCount: this.state.previousRotations.size,
      smoothingStats: this.getSmoothingStats(),
    };
  }

  /**
   * Set custom smoothing factor for a specific bone
   */
  public setBoneSmoothingFactor(
    _boneName: VRMHumanBoneName,
    _factor: number
  ): void {
    // This can be used to fine-tune smoothing for specific bones
  }

  /**
   * Get smoothing statistics for debugging
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getSmoothingStats(): any {
    const stats: any = {};

    this.targetBones.forEach((boneName) => {
      const currentSmoothed = this.state.smoothedRotations.get(boneName);
      const previousRotation = this.state.previousRotations.get(boneName);

      if (currentSmoothed && previousRotation) {
        // Calculate rotation difference
        const diff = new THREE.Quaternion();
        diff.multiplyQuaternions(currentSmoothed, previousRotation.invert());

        // Convert to Euler angles for easier reading
        const euler = new THREE.Euler();
        euler.setFromQuaternion(diff);

        stats[boneName] = {
          rotationDifference: {
            x: THREE.MathUtils.radToDeg(euler.x),
            y: THREE.MathUtils.radToDeg(euler.y),
            z: THREE.MathUtils.radToDeg(euler.z),
          },
        };
      }
    });

    return stats;
  }
}

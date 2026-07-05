/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';

export interface AnimationSmoothingConfig {
  enabled: boolean;
  targetFrameRate: number; // Target FPS for keyframe updates (e.g., 12 FPS = every 5th frame at 60 FPS)
  interpolationMethod: 'linear' | 'easeInOut' | 'smoothstep' | 'cubic';
  smoothingStrength: number; // 0-1, how much to smooth (0 = no smoothing, 1 = maximum smoothing)
  maxInterpolationFrames: number; // Maximum frames to interpolate between keyframes
}

export interface SmoothingState {
  lastKeyframeTime: number;
  nextKeyframeTime: number;
  currentFrame: number;
  totalFrames: number;
  isInterpolating: boolean;
}

export class AnimationSmoother {
  private config: AnimationSmoothingConfig;
  private state: SmoothingState;
  private clock: THREE.Clock;
  private frameCount: number = 0;
  private lastUpdateTime: number = 0;

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
    };
  }

  /**
   * Check if we should update on this frame based on target frame rate
   */
  public shouldUpdate(): boolean {
    this.frameCount++;

    if (!this.config.enabled) {
      // Debug: log when smoothing is disabled
      if (this.frameCount % 60 === 0) {
        // Log every 60 frames to avoid spam
        console.log(
          '[AnimationSmoother] Smoothing disabled - updating every frame'
        );
      }
      return true;
    }

    const currentTime = this.clock.getElapsedTime();
    const frameInterval = 1.0 / this.config.targetFrameRate;

    // Check if enough time has passed since last keyframe
    if (currentTime - this.state.lastKeyframeTime >= frameInterval) {
      this.state.lastKeyframeTime = currentTime;
      this.state.nextKeyframeTime = currentTime + frameInterval;
      this.state.currentFrame = 0;
      this.state.totalFrames = Math.ceil(frameInterval * 60); // Estimate frames until next keyframe
      this.state.isInterpolating = false;

      // Debug: log keyframe updates
      if (this.frameCount % 60 === 0) {
        console.log(
          `[AnimationSmoother] Keyframe update - target FPS: ${this.config.targetFrameRate}, interval: ${frameInterval.toFixed(3)}s`
        );
      }
      return true;
    }

    // Mark as interpolating between keyframes
    this.state.isInterpolating = true;
    this.state.currentFrame++;

    // Debug: log interpolation
    if (this.frameCount % 60 === 0) {
      console.log(
        `[AnimationSmoother] Interpolating frame ${this.state.currentFrame}/${this.state.totalFrames}`
      );
    }
    return false;
  }

  /**
   * Get interpolation factor between 0 and 1 for smooth transitions
   */
  public getInterpolationFactor(): number {
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
   * Apply smoothing to a value using the current interpolation factor
   */
  public smoothValue(
    currentValue: number,
    targetValue: number,
    previousValue?: number
  ): number {
    if (!this.config.enabled) return targetValue;

    const factor = this.getInterpolationFactor();
    const smoothingFactor = this.config.smoothingStrength * factor;

    if (previousValue !== undefined) {
      // Use previous value for smoother transitions
      return THREE.MathUtils.lerp(previousValue, targetValue, smoothingFactor);
    }

    return THREE.MathUtils.lerp(currentValue, targetValue, smoothingFactor);
  }

  /**
   * Apply smoothing to a Vector3
   */
  public smoothVector3(
    currentVector: THREE.Vector3,
    targetVector: THREE.Vector3,
    previousVector?: THREE.Vector3
  ): THREE.Vector3 {
    if (!this.config.enabled) return targetVector.clone();

    const factor = this.getInterpolationFactor();
    const smoothingFactor = this.config.smoothingStrength * factor;
    const result = new THREE.Vector3();

    if (previousVector) {
      result.lerpVectors(previousVector, targetVector, smoothingFactor);
    } else {
      result.lerpVectors(currentVector, targetVector, smoothingFactor);
    }

    return result;
  }

  /**
   * Apply smoothing to a Quaternion
   */
  public smoothQuaternion(
    currentQuaternion: THREE.Quaternion,
    targetQuaternion: THREE.Quaternion,
    previousQuaternion?: THREE.Quaternion
  ): THREE.Quaternion {
    if (!this.config.enabled) return targetQuaternion.clone();

    const factor = this.getInterpolationFactor();
    const smoothingFactor = this.config.smoothingStrength * factor;
    const result = new THREE.Quaternion();

    if (previousQuaternion) {
      result.slerpQuaternions(
        previousQuaternion,
        targetQuaternion,
        smoothingFactor
      );
    } else {
      result.slerpQuaternions(
        currentQuaternion,
        targetQuaternion,
        smoothingFactor
      );
    }

    return result;
  }

  /**
   * Update the configuration
   */
  public updateConfig(newConfig: Partial<AnimationSmoothingConfig>): void {
    console.log('[AnimationSmoother] Updating config:', newConfig);
    this.config = { ...this.config, ...newConfig };
    console.log('[AnimationSmoother] New config:', this.config);
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
  public getState(): SmoothingState {
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
    };
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): any {
    return {
      config: this.getConfig(),
      state: this.getState(),
      currentTime: this.clock.getElapsedTime(),
      frameCount: this.frameCount,
      isInterpolating: this.state.isInterpolating,
      interpolationFactor: this.getInterpolationFactor(),
    };
  }
}

import { VRMExpressionPresetName } from '@pixiv/three-vrm';

export interface EmotionState {
  current: VRMExpressionPresetName;
  previous: VRMExpressionPresetName | null;
  intensity: number; // 0-1 for current emotion
  previousIntensity: number; // 0-1 for previous emotion
  lastChangeTime: number; // timestamp of last emotion change
  modulationPhase: number; // 0-1 for subtle modulation cycle

  // New randomization state
  randomPhase: number; // 0-1 for random modulation cycle
  randomValue: number; // Current random modulation value (-1 to 1)
  neutralDriftPhase: number; // 0-1 for neutral drift cycle
  neutralDriftValue: number; // Current neutral drift value (0 to 1)

  // Blendshape Turbo state
  turboActive: boolean; // Whether turbo is currently active
  turboIntensity: number; // Current turbo boost intensity (0-1)
  lastTurboTime: number; // When turbo was last triggered
}

export interface EmotionModulationConfig {
  basePreviousIntensity: number; // Base intensity for previous emotion (0.3-0.5)
  modulationAmplitude: number; // How much to vary the intensity (0.1-0.2)
  modulationFrequency: number; // How fast to modulate (cycles per second)
  transitionDuration: number; // How long to transition between emotions (seconds)
  neutralBlendFactor: number; // How much to blend with neutral (0.5-0.8)

  // New randomization parameters
  randomModulationEnabled: boolean; // Enable random modulation
  randomModulationStrength: number; // Strength of random modulation (0.1-0.3)
  randomModulationPeriod: number; // How long each random phase lasts (seconds)
  neutralDriftEnabled: boolean; // Enable gradual drift toward neutral
  neutralDriftStrength: number; // How much to drift toward neutral (0.01-0.05)
  neutralDriftPeriod: number; // How long neutral drift cycles last (seconds)

  // Blendshape Turbo parameters
  blendshapeTurboEnabled: boolean; // Enable audio-driven emotion boosting
  blendshapeTurboThreshold: number; // Audio volume threshold to trigger turbo (0.3-0.8)
  blendshapeTurboStrength: number; // How much to boost emotion intensity (0.1-0.5)
  blendshapeTurboDecayRate: number; // How fast turbo effect decays (0.1-1.0)
}

export class EmotionStateManager {
  private state: EmotionState;
  private config: EmotionModulationConfig;
  private clock: { getElapsedTime: () => number };

  constructor(clock: { getElapsedTime: () => number }) {
    this.clock = clock;
    this.config = {
      basePreviousIntensity: 0.4,
      modulationAmplitude: 0.25, // Increased from 0.15
      modulationFrequency: 0.3, // Decreased from 1.2 Hz = 3.33 second cycle (much slower)
      transitionDuration: 2.0,
      neutralBlendFactor: 0.6,

      // New randomization parameters
      randomModulationEnabled: true,
      randomModulationStrength: 0.35, // Increased from 0.2
      randomModulationPeriod: 8.0, // Increased from 4.0 = slower cycles
      neutralDriftEnabled: true,
      neutralDriftStrength: 0.03, // Increased from 0.02
      neutralDriftPeriod: 20.0, // Increased from 12.0 = slower cycles

      // Blendshape Turbo parameters
      blendshapeTurboEnabled: true,
      blendshapeTurboThreshold: 0.6, // Trigger turbo at 60% volume
      blendshapeTurboStrength: 0.3, // Boost emotion by 30%
      blendshapeTurboDecayRate: 0.3, // Decay over ~3 seconds
    };

    this.state = {
      current: 'neutral',
      previous: null,
      intensity: 1.0,
      previousIntensity: 0.0,
      lastChangeTime: 0,
      modulationPhase: 0,
      randomPhase: 0,
      randomValue: 0,
      neutralDriftPhase: 0,
      neutralDriftValue: 0,
      turboActive: false,
      turboIntensity: 0.0,
      lastTurboTime: 0,
    };
  }

  /**
   * Update the current emotion and manage state transitions
   */
  public setEmotion(emotion: VRMExpressionPresetName): void {
    const currentTime = this.clock.getElapsedTime();

    // If this is a new emotion (not neutral), store current as previous
    if (emotion !== 'neutral' && emotion !== this.state.current) {
      this.state.previous = this.state.current;
      this.state.previousIntensity = this.state.intensity;
      this.state.lastChangeTime = currentTime;
    }

    this.state.current = emotion;

    // Reset modulation phase for new emotion
    this.state.modulationPhase = 0;
  }

  /**
   * Update blendshape turbo state based on audio volume
   * @param audioVolume Normalized audio volume (0-1)
   */
  public updateTurbo(audioVolume: number): void {
    if (!this.config.blendshapeTurboEnabled) return;

    const currentTime = this.clock.getElapsedTime();

    // Check if audio volume exceeds threshold
    if (audioVolume >= this.config.blendshapeTurboThreshold) {
      // Activate turbo
      this.state.turboActive = true;
      this.state.turboIntensity = 1.0; // Full turbo boost
      this.state.lastTurboTime = currentTime;
    } else if (this.state.turboActive) {
      // Decay turbo effect
      const timeSinceTurbo = currentTime - this.state.lastTurboTime;
      const decayTime = 1.0 / this.config.blendshapeTurboDecayRate;

      if (timeSinceTurbo >= decayTime) {
        // Turbo has fully decayed
        this.state.turboActive = false;
        this.state.turboIntensity = 0.0;
      } else {
        // Calculate decayed intensity
        const decayProgress = timeSinceTurbo / decayTime;
        this.state.turboIntensity = 1.0 - decayProgress;
      }
    }
  }

  /**
   * Get the current emotion state with modulation applied
   */
  public getCurrentEmotionState(): EmotionState {
    const currentTime = this.clock.getElapsedTime();

    // Update modulation phase
    this.state.modulationPhase =
      (currentTime * this.config.modulationFrequency) % 1;

    // Update random modulation
    if (this.config.randomModulationEnabled) {
      this.state.randomPhase =
        (currentTime / this.config.randomModulationPeriod) % 1;

      // Generate smooth random value using multiple sine waves for more natural variation
      // Slower frequencies for more stable, less ping-ponging variation
      const random1 = Math.sin(currentTime * 0.2) * 0.6; // Decreased frequency for stability
      const random2 = Math.cos(currentTime * 0.3) * 0.4; // Decreased frequency for stability
      const random3 = Math.sin(currentTime * 0.1) * 0.3; // Decreased frequency for stability
      const random4 = Math.cos(currentTime * 0.15) * 0.2; // Decreased frequency for stability
      this.state.randomValue = (random1 + random2 + random3 + random4) / 4;
    }

    // Update neutral drift
    if (this.config.neutralDriftEnabled) {
      this.state.neutralDriftPhase =
        (currentTime / this.config.neutralDriftPeriod) % 1;

      // Create a smooth drift toward neutral using sine wave
      this.state.neutralDriftValue =
        Math.sin(this.state.neutralDriftPhase * Math.PI * 2) * 0.5 + 0.5;
    }

    return { ...this.state };
  }

  /**
   * Get the target intensity for the current emotion
   */
  public getCurrentEmotionIntensity(): number {
    const state = this.getCurrentEmotionState();

    if (state.current === 'neutral') {
      return 1.0; // Full neutral
    }

    // Base intensity
    let intensity = 1.0;

    // Add subtle modulation to current emotion
    const modulation =
      Math.sin(state.modulationPhase * Math.PI * 2) *
      this.config.modulationAmplitude;
    intensity += modulation;

    // Add random modulation for more natural variation
    if (this.config.randomModulationEnabled) {
      const randomModulation =
        state.randomValue * this.config.randomModulationStrength;
      intensity += randomModulation;
    }

    // Add neutral drift - gradually reduce intensity toward neutral
    if (this.config.neutralDriftEnabled) {
      const neutralDrift =
        (1.0 - state.neutralDriftValue) * this.config.neutralDriftStrength;
      intensity = Math.max(0.2, intensity - neutralDrift); // Reduced minimum to 0.2 for more variation
    }

    // Apply blendshape turbo boost if active
    if (
      this.config.blendshapeTurboEnabled &&
      state.turboActive &&
      state.turboIntensity > 0
    ) {
      const turboBoost =
        state.turboIntensity * this.config.blendshapeTurboStrength;
      intensity += turboBoost;
    }

    return Math.max(0.1, Math.min(1.0, intensity));
  }

  /**
   * Get the target intensity for the previous emotion
   */
  public getPreviousEmotionIntensity(): number {
    const state = this.getCurrentEmotionState();

    if (!state.previous || state.previous === 'neutral') {
      return 0.0;
    }

    // Calculate time since last emotion change
    const timeSinceChange = this.clock.getElapsedTime() - state.lastChangeTime;
    const transitionProgress = Math.min(
      1.0,
      timeSinceChange / this.config.transitionDuration
    );

    // Gradually reduce previous emotion intensity over time
    const baseIntensity = this.config.basePreviousIntensity;
    const timeDecay = Math.max(0, 1.0 - transitionProgress * 0.5); // Slow decay

    // Add subtle modulation to previous emotion
    const modulation =
      Math.cos(state.modulationPhase * Math.PI * 2) *
      this.config.modulationAmplitude *
      0.5;

    // Add random modulation to previous emotion as well
    let intensity = baseIntensity * timeDecay + modulation;

    if (this.config.randomModulationEnabled) {
      const randomModulation =
        state.randomValue * this.config.randomModulationStrength * 0.4; // Increased from 0.3 for more variation
      intensity += randomModulation;
    }

    return Math.max(0, Math.min(1.0, intensity));
  }

  /**
   * Get both current and previous emotion with their intensities
   */
  public getEmotionBlend(): {
    current: { emotion: VRMExpressionPresetName; intensity: number };
    previous: { emotion: VRMExpressionPresetName | null; intensity: number };
  } {
    return {
      current: {
        emotion: this.state.current,
        intensity: this.getCurrentEmotionIntensity(),
      },
      previous: {
        emotion: this.state.previous,
        intensity: this.getPreviousEmotionIntensity(),
      },
    };
  }

  /**
   * Update configuration parameters
   */
  public updateConfig(newConfig: Partial<EmotionModulationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): EmotionModulationConfig {
    return { ...this.config };
  }

  /**
   * Reset emotion state to neutral
   */
  public resetToNeutral(): void {
    this.state = {
      current: 'neutral',
      previous: null,
      intensity: 1.0,
      previousIntensity: 0.0,
      lastChangeTime: this.clock.getElapsedTime(),
      modulationPhase: 0,
      randomPhase: 0,
      randomValue: 0,
      neutralDriftPhase: 0,
      neutralDriftValue: 0,
      turboActive: false,
      turboIntensity: 0.0,
      lastTurboTime: 0,
    };
  }

  /**
   * Get debug information about current state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDebugInfo(): any {
    const blend = this.getEmotionBlend();
    return {
      state: { ...this.state },
      config: { ...this.config },
      blend,
      timeSinceChange: this.clock.getElapsedTime() - this.state.lastChangeTime,
    };
  }
}

import { VRM, VRMExpressionManager } from '@pixiv/three-vrm';

export interface EyeMovementConfig {
  // Macro movement settings
  macroMovementEnabled: boolean;
  macroMovementInterval: { min: number; max: number }; // seconds between macro movements
  macroMovementDuration: { min: number; max: number }; // seconds for macro movement
  macroMovementStrength: { min: number; max: number }; // intensity of macro movement (0-1)

  // Micro movement settings
  microMovementEnabled: boolean;
  microMovementInterval: { min: number; max: number }; // seconds between micro movements
  microMovementDuration: { min: number; max: number }; // seconds for micro movement
  microMovementStrength: { min: number; max: number }; // intensity of micro movement (0-1)

  // Transition settings
  transitionSmoothing: number; // smoothing factor for transitions (0-1)
  maxConcurrentMovements: number; // maximum number of concurrent eye movements

  // Movement patterns
  movementPatterns: EyeMovementPattern[];
}

export interface EyeMovementPattern {
  name: string;
  movements: EyeMovement[];
  weight: number; // probability weight for this pattern
}

export interface EyeMovement {
  direction:
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'upLeft'
    | 'upRight'
    | 'downLeft'
    | 'downRight';
  intensity: number; // 0-1
  duration: number; // seconds
}

export interface ActiveEyeMovement {
  id: string;
  direction:
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'upLeft'
    | 'upRight'
    | 'downLeft'
    | 'downRight';
  intensity: number;
  startTime: number;
  duration: number;
  type: 'macro' | 'micro';
  currentValue: number; // current intensity value (0-1)
}

export class EyeMovementController {
  private vrm: VRM;
  private expressionManager?: VRMExpressionManager;
  private config: EyeMovementConfig;
  private clock: { getElapsedTime: () => number };

  // State management
  private activeMovements: Map<string, ActiveEyeMovement> = new Map();
  private lastMacroMovementTime: number = 0;
  private lastMicroMovementTime: number = 0;
  private nextMacroMovementDelay: number = 0;
  private nextMicroMovementDelay: number = 0;
  private movementIdCounter: number = 0;

  constructor(vrm: VRM, clock: { getElapsedTime: () => number }) {
    this.vrm = vrm;
    this.clock = clock;
    this.expressionManager = vrm.expressionManager;

    // Initialize with default configuration
    this.config = {
      macroMovementEnabled: true,
      macroMovementInterval: { min: 3.0, max: 8.0 },
      macroMovementDuration: { min: 0.8, max: 2.0 },
      macroMovementStrength: { min: 0.3, max: 0.7 },

      microMovementEnabled: true,
      microMovementInterval: { min: 0.5, max: 2.0 },
      microMovementDuration: { min: 0.1, max: 0.4 },
      microMovementStrength: { min: 0.1, max: 0.3 },

      transitionSmoothing: 0.8,
      maxConcurrentMovements: 2,

      movementPatterns: [
        {
          name: 'natural',
          weight: 0.6,
          movements: [
            { direction: 'left', intensity: 0.5, duration: 1.0 },
            { direction: 'right', intensity: 0.5, duration: 1.0 },
            { direction: 'up', intensity: 0.4, duration: 0.8 },
            { direction: 'down', intensity: 0.4, duration: 0.8 },
          ],
        },
        {
          name: 'curious',
          weight: 0.3,
          movements: [
            { direction: 'upLeft', intensity: 0.6, duration: 1.2 },
            { direction: 'upRight', intensity: 0.6, duration: 1.2 },
            { direction: 'downLeft', intensity: 0.5, duration: 1.0 },
            { direction: 'downRight', intensity: 0.5, duration: 1.0 },
          ],
        },
        {
          name: 'subtle',
          weight: 0.1,
          movements: [
            { direction: 'left', intensity: 0.2, duration: 0.5 },
            { direction: 'right', intensity: 0.2, duration: 0.5 },
            { direction: 'up', intensity: 0.15, duration: 0.4 },
            { direction: 'down', intensity: 0.15, duration: 0.4 },
          ],
        },
      ],
    };

    // Initialize next movement delays
    this.nextMacroMovementDelay = this.getRandomDelay(
      this.config.macroMovementInterval
    );
    this.nextMicroMovementDelay = this.getRandomDelay(
      this.config.microMovementInterval
    );
  }

  /**
   * Update eye movements - called every frame
   */
  public update(_deltaTime: number): void {
    const currentTime = this.clock.getElapsedTime();

    // Update active movements
    this.updateActiveMovements(currentTime);

    // Check if we should start new movements
    this.checkForNewMovements(currentTime);

    // Apply current eye movement values to VRM
    this.applyEyeMovements();
  }

  /**
   * Update all active eye movements
   */
  private updateActiveMovements(currentTime: number): void {
    const movementsToRemove: string[] = [];

    for (const [id, movement] of this.activeMovements) {
      const elapsed = currentTime - movement.startTime;
      const progress = Math.min(1.0, elapsed / movement.duration);

      // Calculate current value using smooth easing
      const easedProgress = this.easeInOut(progress);
      movement.currentValue = movement.intensity * easedProgress;

      // Mark for removal if movement is complete
      if (progress >= 1.0) {
        movementsToRemove.push(id);
      }
    }

    // Remove completed movements
    movementsToRemove.forEach((id) => {
      this.activeMovements.delete(id);
    });
  }

  /**
   * Check if we should start new macro or micro movements
   */
  private checkForNewMovements(currentTime: number): void {
    // Check for macro movements
    if (
      this.config.macroMovementEnabled &&
      currentTime - this.lastMacroMovementTime >= this.nextMacroMovementDelay &&
      this.activeMovements.size < this.config.maxConcurrentMovements
    ) {
      this.startMacroMovement(currentTime);
      this.lastMacroMovementTime = currentTime;
      this.nextMacroMovementDelay = this.getRandomDelay(
        this.config.macroMovementInterval
      );
    }

    // Check for micro movements
    if (
      this.config.microMovementEnabled &&
      currentTime - this.lastMicroMovementTime >= this.nextMicroMovementDelay &&
      this.activeMovements.size < this.config.maxConcurrentMovements
    ) {
      this.startMicroMovement(currentTime);
      this.lastMicroMovementTime = currentTime;
      this.nextMicroMovementDelay = this.getRandomDelay(
        this.config.microMovementInterval
      );
    }
  }

  /**
   * Start a new macro eye movement
   */
  private startMacroMovement(currentTime: number): void {
    const pattern = this.selectRandomPattern();
    const movement = this.selectRandomMovement(pattern);

    const duration = this.getRandomDuration(this.config.macroMovementDuration);
    const intensity = this.getRandomIntensity(
      this.config.macroMovementStrength
    );

    const activeMovement: ActiveEyeMovement = {
      id: `macro_${++this.movementIdCounter}`,
      direction: movement.direction,
      intensity: intensity * movement.intensity,
      startTime: currentTime,
      duration: duration,
      type: 'macro',
      currentValue: 0,
    };

    this.activeMovements.set(activeMovement.id, activeMovement);
  }

  /**
   * Start a new micro eye movement
   */
  private startMicroMovement(currentTime: number): void {
    const pattern = this.selectRandomPattern();
    const movement = this.selectRandomMovement(pattern);

    const duration = this.getRandomDuration(this.config.microMovementDuration);
    const intensity = this.getRandomIntensity(
      this.config.microMovementStrength
    );

    const activeMovement: ActiveEyeMovement = {
      id: `micro_${++this.movementIdCounter}`,
      direction: movement.direction,
      intensity: intensity * movement.intensity,
      startTime: currentTime,
      duration: duration,
      type: 'micro',
      currentValue: 0,
    };

    this.activeMovements.set(activeMovement.id, activeMovement);
  }

  /**
   * Apply current eye movement values to VRM blendshapes
   */
  private applyEyeMovements(): void {
    if (!this.expressionManager) return;

    // Initialize eye movement values
    let lookUp = 0;
    let lookDown = 0;
    let lookLeft = 0;
    let lookRight = 0;

    // Accumulate values from all active movements
    for (const movement of this.activeMovements.values()) {
      const value = movement.currentValue;

      switch (movement.direction) {
        case 'up':
          lookUp = Math.max(lookUp, value);
          break;
        case 'down':
          lookDown = Math.max(lookDown, value);
          break;
        case 'left':
          lookLeft = Math.max(lookLeft, value);
          break;
        case 'right':
          lookRight = Math.max(lookRight, value);
          break;
        case 'upLeft':
          lookUp = Math.max(lookUp, value * 0.7);
          lookLeft = Math.max(lookLeft, value * 0.7);
          break;
        case 'upRight':
          lookUp = Math.max(lookUp, value * 0.7);
          lookRight = Math.max(lookRight, value * 0.7);
          break;
        case 'downLeft':
          lookDown = Math.max(lookDown, value * 0.7);
          lookLeft = Math.max(lookLeft, value * 0.7);
          break;
        case 'downRight':
          lookDown = Math.max(lookDown, value * 0.7);
          lookRight = Math.max(lookRight, value * 0.7);
          break;
      }
    }

    // Apply smoothing to prevent jarring transitions
    const smoothing = this.config.transitionSmoothing;

    // Get current values and apply smoothing
    const currentLookUp = this.expressionManager.getValue('lookUp') || 0;
    const currentLookDown = this.expressionManager.getValue('lookDown') || 0;
    const currentLookLeft = this.expressionManager.getValue('lookLeft') || 0;
    const currentLookRight = this.expressionManager.getValue('lookRight') || 0;

    const smoothedLookUp = currentLookUp * smoothing + lookUp * (1 - smoothing);
    const smoothedLookDown =
      currentLookDown * smoothing + lookDown * (1 - smoothing);
    const smoothedLookLeft =
      currentLookLeft * smoothing + lookLeft * (1 - smoothing);
    const smoothedLookRight =
      currentLookRight * smoothing + lookRight * (1 - smoothing);

    // Apply to VRM
    this.expressionManager.setValue('lookUp', smoothedLookUp);
    this.expressionManager.setValue('lookDown', smoothedLookDown);
    this.expressionManager.setValue('lookLeft', smoothedLookLeft);
    this.expressionManager.setValue('lookRight', smoothedLookRight);
  }

  /**
   * Select a random movement pattern based on weights
   */
  private selectRandomPattern(): EyeMovementPattern {
    const totalWeight = this.config.movementPatterns.reduce(
      (sum, pattern) => sum + pattern.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const pattern of this.config.movementPatterns) {
      random -= pattern.weight;
      if (random <= 0) {
        return pattern;
      }
    }

    return this.config.movementPatterns[0]; // fallback
  }

  /**
   * Select a random movement from a pattern
   */
  private selectRandomMovement(pattern: EyeMovementPattern): EyeMovement {
    const index = Math.floor(Math.random() * pattern.movements.length);
    return pattern.movements[index];
  }

  /**
   * Get a random delay within the specified range
   */
  private getRandomDelay(range: { min: number; max: number }): number {
    return range.min + Math.random() * (range.max - range.min);
  }

  /**
   * Get a random duration within the specified range
   */
  private getRandomDuration(range: { min: number; max: number }): number {
    return range.min + Math.random() * (range.max - range.min);
  }

  /**
   * Get a random intensity within the specified range
   */
  private getRandomIntensity(range: { min: number; max: number }): number {
    return range.min + Math.random() * (range.max - range.min);
  }

  /**
   * Smooth easing function for movement transitions
   */
  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EyeMovementConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): EyeMovementConfig {
    return { ...this.config };
  }

  /**
   * Clear all active eye movements
   */
  public clearAllMovements(): void {
    this.activeMovements.clear();
    if (this.expressionManager) {
      this.expressionManager.setValue('lookUp', 0);
      this.expressionManager.setValue('lookDown', 0);
      this.expressionManager.setValue('lookLeft', 0);
      this.expressionManager.setValue('lookRight', 0);
    }
  }

  /**
   * Get debug information
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDebugInfo(): any {
    return {
      config: this.config,
      activeMovements: Array.from(this.activeMovements.values()),
      activeMovementCount: this.activeMovements.size,
      lastMacroMovementTime: this.lastMacroMovementTime,
      lastMicroMovementTime: this.lastMicroMovementTime,
      nextMacroMovementDelay: this.nextMacroMovementDelay,
      nextMicroMovementDelay: this.nextMicroMovementDelay,
    };
  }
}

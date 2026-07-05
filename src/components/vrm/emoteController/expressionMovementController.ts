import {
  VRM,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from '@pixiv/three-vrm';

export interface ExpressionMovementConfig {
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
  maxConcurrentMovements: number; // maximum number of concurrent expression movements

  // Expression patterns
  expressionPatterns: ExpressionMovementPattern[];
}

export interface ExpressionMovementPattern {
  name: string;
  expressions: ExpressionMovement[];
  weight: number; // probability weight for this pattern
}

export interface ExpressionMovement {
  expression: VRMExpressionPresetName;
  intensity: number; // 0-1
  duration: number; // seconds
}

export interface ActiveExpressionMovement {
  id: string;
  expression: VRMExpressionPresetName;
  intensity: number;
  startTime: number;
  duration: number;
  type: 'macro' | 'micro';
  currentValue: number; // current intensity value (0-1)
}

export class ExpressionMovementController {
  private vrm: VRM;
  private expressionManager?: VRMExpressionManager;
  private config: ExpressionMovementConfig;
  private clock: { getElapsedTime: () => number };

  // State management
  private activeMovements: Map<string, ActiveExpressionMovement> = new Map();
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
      macroMovementInterval: { min: 8.0, max: 15.0 }, // Longer intervals for expressions
      macroMovementDuration: { min: 2.0, max: 4.0 },
      macroMovementStrength: { min: 0.4, max: 0.8 },

      microMovementEnabled: true,
      microMovementInterval: { min: 2.0, max: 6.0 },
      microMovementDuration: { min: 0.5, max: 1.5 },
      microMovementStrength: { min: 0.1, max: 0.3 },

      transitionSmoothing: 0.8,
      maxConcurrentMovements: 1, // Usually only one expression at a time

      expressionPatterns: [
        {
          name: 'emotional',
          weight: 0.4,
          expressions: [
            { expression: 'happy', intensity: 0.6, duration: 2.0 },
            { expression: 'sad', intensity: 0.5, duration: 2.0 },
            { expression: 'angry', intensity: 0.4, duration: 1.5 },
            { expression: 'surprised', intensity: 0.5, duration: 1.0 },
          ],
        },
        {
          name: 'subtle',
          weight: 0.4,
          expressions: [
            { expression: 'relaxed', intensity: 0.4, duration: 2.5 },
            { expression: 'happy', intensity: 0.3, duration: 1.5 },
            { expression: 'sad', intensity: 0.2, duration: 1.5 },
          ],
        },
        {
          name: 'neutral_variations',
          weight: 0.2,
          expressions: [
            { expression: 'neutral', intensity: 0.8, duration: 3.0 },
            { expression: 'relaxed', intensity: 0.3, duration: 2.0 },
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
   * Update expression movements - called every frame
   */
  public update(_deltaTime: number): void {
    const currentTime = this.clock.getElapsedTime();

    // Update active movements
    this.updateActiveMovements(currentTime);

    // Check if we should start new movements
    this.checkForNewMovements(currentTime);

    // Apply current expression movement values to VRM
    this.applyExpressionMovements();
  }

  /**
   * Update all active expression movements
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
   * Start a new macro expression movement
   */
  private startMacroMovement(currentTime: number): void {
    const pattern = this.selectRandomPattern();
    const movement = this.selectRandomMovement(pattern);

    const duration = this.getRandomDuration(this.config.macroMovementDuration);
    const intensity = this.getRandomIntensity(
      this.config.macroMovementStrength
    );

    const activeMovement: ActiveExpressionMovement = {
      id: `macro_${++this.movementIdCounter}`,
      expression: movement.expression,
      intensity: intensity * movement.intensity,
      startTime: currentTime,
      duration: duration,
      type: 'macro',
      currentValue: 0,
    };

    this.activeMovements.set(activeMovement.id, activeMovement);
  }

  /**
   * Start a new micro expression movement
   */
  private startMicroMovement(currentTime: number): void {
    const pattern = this.selectRandomPattern();
    const movement = this.selectRandomMovement(pattern);

    const duration = this.getRandomDuration(this.config.microMovementDuration);
    const intensity = this.getRandomIntensity(
      this.config.microMovementStrength
    );

    const activeMovement: ActiveExpressionMovement = {
      id: `micro_${++this.movementIdCounter}`,
      expression: movement.expression,
      intensity: intensity * movement.intensity,
      startTime: currentTime,
      duration: duration,
      type: 'micro',
      currentValue: 0,
    };

    this.activeMovements.set(activeMovement.id, activeMovement);
  }

  /**
   * Apply current expression movement values to VRM blendshapes
   */
  private applyExpressionMovements(): void {
    if (!this.expressionManager) return;

    // Only clear/apply base when there are active movements to avoid wiping primary emotions needlessly
    if (this.activeMovements.size > 0) {
      this.clearAllExpressions();
      this.expressionManager.setValue('neutral', 1.0);
    }

    // Apply active movements
    for (const movement of this.activeMovements.values()) {
      const value = movement.currentValue;

      // Apply smoothing to prevent jarring transitions
      const smoothing = this.config.transitionSmoothing;
      const currentValue =
        this.expressionManager.getValue(movement.expression) || 0;
      const smoothedValue = currentValue * smoothing + value * (1 - smoothing);

      this.expressionManager.setValue(movement.expression, smoothedValue);
    }
  }

  /**
   * Select a random movement pattern based on weights
   */
  private selectRandomPattern(): ExpressionMovementPattern {
    const totalWeight = this.config.expressionPatterns.reduce(
      (sum, pattern) => sum + pattern.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const pattern of this.config.expressionPatterns) {
      random -= pattern.weight;
      if (random <= 0) {
        return pattern;
      }
    }

    return this.config.expressionPatterns[0]; // fallback
  }

  /**
   * Select a random movement from a pattern
   */
  private selectRandomMovement(
    pattern: ExpressionMovementPattern
  ): ExpressionMovement {
    const index = Math.floor(Math.random() * pattern.expressions.length);
    return pattern.expressions[index];
  }

  /**
   * Clear all expressions except blink expressions
   */
  private clearAllExpressions(): void {
    if (!this.expressionManager) return;

    const presets: VRMExpressionPresetName[] = [
      'neutral',
      'happy',
      'angry',
      'sad',
      'relaxed',
      'surprised',
    ];

    presets.forEach((preset) => {
      this.expressionManager?.setValue(preset, 0);
    });
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
  public updateConfig(newConfig: Partial<ExpressionMovementConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ExpressionMovementConfig {
    return { ...this.config };
  }

  /**
   * Clear all active expression movements
   */
  public clearAllMovements(): void {
    this.activeMovements.clear();
    this.clearAllExpressions();
    if (this.expressionManager) {
      this.expressionManager.setValue('neutral', 1.0);
    }
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): {
    config: ExpressionMovementConfig;
    activeMovements: ActiveExpressionMovement[];
    activeMovementCount: number;
    lastMacroMovementTime: number;
    lastMicroMovementTime: number;
    nextMacroMovementDelay: number;
    nextMicroMovementDelay: number;
  } {
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

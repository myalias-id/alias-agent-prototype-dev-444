import {
  VRM,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from '@pixiv/three-vrm';

export interface ExpressionCycleConfig {
  enabled: boolean;
  cycleInterval: { min: number; max: number }; // seconds between expression changes
  transitionDuration: { min: number; max: number }; // seconds for transition
  blendFactor: { min: number; max: number }; // how much to blend with neutral (0-1)
  randomizeOrder: boolean; // whether to randomize the order of expressions
  loopMode: 'sequential' | 'random' | 'weighted'; // how to cycle through expressions
}

export interface ExpressionCycleItem {
  expression: string; // VRM 0.0 expression names
  weight?: number; // probability weight for random/weighted modes
  duration?: number; // custom duration for this expression
  intensity?: number; // custom intensity for this expression (0-1)
}

export interface ActiveExpressionTransition {
  fromExpression: string; // VRM 0.0 expression names
  toExpression: string; // VRM 0.0 expression names
  startTime: number;
  duration: number;
  progress: number; // 0-1
  fromIntensity: number;
  toIntensity: number;
  blendFactor: number;
}

export class ExpressionCycler {
  private vrm: VRM;
  private expressionManager?: VRMExpressionManager;
  private config: ExpressionCycleConfig;
  private clock: { getElapsedTime: () => number };

  // Expression cycle data
  private expressionCycle: ExpressionCycleItem[] = [];
  private currentCycleIndex: number = 0;

  // State management
  private activeTransition: ActiveExpressionTransition | null = null;
  private lastCycleTime: number = 0;
  private nextCycleDelay: number = 0;
  private isTransitioning: boolean = false;

  constructor(vrm: VRM, clock: { getElapsedTime: () => number }) {
    this.vrm = vrm;
    this.clock = clock;
    this.expressionManager = vrm.expressionManager;

    // Initialize with default configuration
    this.config = {
      enabled: false, // Disable expression cycling
      cycleInterval: { min: 1.0, max: 2.0 }, // Rapid cycling for testing
      transitionDuration: { min: 0.5, max: 1.0 }, // Quick transitions
      blendFactor: { min: 0.3, max: 0.7 },
      randomizeOrder: false,
      loopMode: 'sequential',
    };

    // Initialize with default expression cycle using the expressions that actually work
    this.expressionCycle = [
      { expression: 'neutral', weight: 0.3, intensity: 1.0 },
      { expression: 'happy', weight: 0.2, intensity: 0.7 },
      { expression: 'angry', weight: 0.15, intensity: 0.5 },
      { expression: 'sad', weight: 0.15, intensity: 0.5 },
      { expression: 'relaxed', weight: 0.1, intensity: 0.6 },
      { expression: 'Surprised', weight: 0.1, intensity: 0.5 }, // Note: capital S in Surprised
    ];

    this.nextCycleDelay = this.getRandomDelay(this.config.cycleInterval);

    // Expression cycler is now ready to cycle through working expressions
  }

  /**
   * Set the expression cycle array
   */
  public setExpressionCycle(cycle: ExpressionCycleItem[]): void {
    this.expressionCycle = [...cycle];
    this.currentCycleIndex = 0;

    // Shuffle if randomize order is enabled
    if (this.config.randomizeOrder) {
      this.shuffleExpressionCycle();
    }
  }

  /**
   * Update expression cycling - called every frame
   */
  public update(_deltaTime: number): void {
    if (!this.config.enabled || this.expressionCycle.length === 0) return;

    const currentTime = this.clock.getElapsedTime();

    // Update active transition
    if (this.activeTransition) {
      this.updateTransition(currentTime);
    }

    // Check if we should start a new cycle
    if (
      !this.isTransitioning &&
      currentTime - this.lastCycleTime >= this.nextCycleDelay
    ) {
      this.startNextExpression(currentTime);
    }
  }

  /**
   * Update the active expression transition
   */
  private updateTransition(currentTime: number): void {
    if (!this.activeTransition) return;

    const elapsed = currentTime - this.activeTransition.startTime;
    const progress = Math.min(1.0, elapsed / this.activeTransition.duration);

    this.activeTransition.progress = progress;

    // Apply the transition to VRM
    this.applyTransition();

    // Check if transition is complete
    if (progress >= 1.0) {
      this.completeTransition();
    }
  }

  /**
   * Apply the current transition to VRM blendshapes
   */
  private applyTransition(): void {
    if (!this.expressionManager || !this.activeTransition) return;

    const {
      fromExpression,
      toExpression,
      progress,
      fromIntensity,
      toIntensity,
      blendFactor,
    } = this.activeTransition;

    // Calculate current values using smooth easing
    const easedProgress = this.easeInOut(progress);

    // Calculate intensities
    const currentFromIntensity = fromIntensity * (1 - easedProgress);
    const currentToIntensity = toIntensity * easedProgress;

    // Apply neutral blend factor
    const neutralIntensity =
      1.0 - Math.max(currentFromIntensity, currentToIntensity) * blendFactor;

    // Clear all expressions first
    this.clearAllExpressions();

    // Apply expressions with calculated intensities using VRM 0.0/1.0 compatible method
    if (fromExpression !== 'neutral' && currentFromIntensity > 0) {
      const fromTrackName =
        this.expressionManager.getExpressionTrackName(fromExpression);
      if (fromTrackName) {
        this.expressionManager.setValue(fromExpression, currentFromIntensity);
      }
    }

    if (toExpression !== 'neutral' && currentToIntensity > 0) {
      const toTrackName =
        this.expressionManager.getExpressionTrackName(toExpression);
      if (toTrackName) {
        this.expressionManager.setValue(toExpression, currentToIntensity);
      }
    }

    // Apply neutral as base
    if (neutralIntensity > 0) {
      const neutralTrackName =
        this.expressionManager.getExpressionTrackName('neutral');
      if (neutralTrackName) {
        this.expressionManager.setValue('neutral', neutralIntensity);
      }
    }
  }

  /**
   * Start the next expression in the cycle
   */
  private startNextExpression(currentTime: number): void {
    if (this.expressionCycle.length === 0) return;

    const nextItem = this.getNextExpressionItem();
    if (!nextItem) return;

    const currentExpression = this.getCurrentExpression();
    const nextExpression = nextItem.expression;

    // Don't transition if it's the same expression
    if (currentExpression === nextExpression) {
      this.lastCycleTime = currentTime;
      this.nextCycleDelay = this.getRandomDelay(this.config.cycleInterval);
      return;
    }

    // Create transition
    const duration =
      nextItem.duration ||
      this.getRandomDuration(this.config.transitionDuration);
    const blendFactor = this.getRandomBlendFactor(this.config.blendFactor);

    this.activeTransition = {
      fromExpression: currentExpression,
      toExpression: nextExpression,
      startTime: currentTime,
      duration: duration,
      progress: 0,
      fromIntensity: this.getCurrentExpressionIntensity(),
      toIntensity: nextItem.intensity || 1.0,
      blendFactor: blendFactor,
    };

    this.isTransitioning = true;
    this.lastCycleTime = currentTime;
    this.nextCycleDelay = this.getRandomDelay(this.config.cycleInterval);
  }

  /**
   * Complete the current transition
   */
  private completeTransition(): void {
    if (!this.activeTransition) return;

    // Ensure final state is applied
    this.applyTransition();

    this.activeTransition = null;
    this.isTransitioning = false;
  }

  /**
   * Get the next expression item based on loop mode
   */
  private getNextExpressionItem(): ExpressionCycleItem | null {
    if (this.expressionCycle.length === 0) return null;

    switch (this.config.loopMode) {
      case 'sequential':
        // eslint-disable-next-line no-case-declarations
        const item = this.expressionCycle[this.currentCycleIndex];
        this.currentCycleIndex =
          (this.currentCycleIndex + 1) % this.expressionCycle.length;
        return item;

      case 'random':
        // eslint-disable-next-line no-case-declarations
        const randomIndex = Math.floor(
          Math.random() * this.expressionCycle.length
        );
        return this.expressionCycle[randomIndex];

      case 'weighted':
        return this.selectWeightedExpression();

      default:
        return this.expressionCycle[0];
    }
  }

  /**
   * Select an expression based on weights
   */
  private selectWeightedExpression(): ExpressionCycleItem | null {
    if (this.expressionCycle.length === 0) return null;

    const totalWeight = this.expressionCycle.reduce(
      (sum, item) => sum + (item.weight || 1),
      0
    );
    let random = Math.random() * totalWeight;

    for (const item of this.expressionCycle) {
      random -= item.weight || 1;
      if (random <= 0) {
        return item;
      }
    }

    return this.expressionCycle[0]; // fallback
  }

  /**
   * Get the current expression (what's currently applied to VRM)
   */
  private getCurrentExpression(): string {
    if (!this.expressionManager) return 'neutral';

    // Check which expression has the highest value using the expressions that work
    const expressions: string[] = [
      'happy',
      'angry',
      'sad',
      'relaxed',
      'Surprised',
    ];
    let maxValue = 0;
    let currentExpression: string = 'neutral';

    for (const expression of expressions) {
      const value =
        this.expressionManager.getValue(
          expression as VRMExpressionPresetName
        ) || 0;
      if (value > maxValue) {
        maxValue = value;
        currentExpression = expression;
      }
    }

    return currentExpression;
  }

  /**
   * Get the current expression intensity
   */
  private getCurrentExpressionIntensity(): number {
    if (!this.expressionManager) return 0;

    const currentExpression = this.getCurrentExpression();
    return this.expressionManager.getValue(currentExpression) || 0;
  }

  /**
   * Clear all expressions except blink expressions
   */
  private clearAllExpressions(): void {
    if (!this.expressionManager) return;

    const presets: string[] = [
      'neutral',
      'happy',
      'angry',
      'sad',
      'relaxed',
      'Surprised',
    ];

    presets.forEach((preset) => {
      const trackName = this.expressionManager?.getExpressionTrackName(
        preset as VRMExpressionPresetName
      );
      if (trackName) {
        this.expressionManager?.setValue(preset as VRMExpressionPresetName, 0);
      }
    });
  }

  /**
   * Shuffle the expression cycle array
   */
  private shuffleExpressionCycle(): void {
    for (let i = this.expressionCycle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.expressionCycle[i], this.expressionCycle[j]] = [
        this.expressionCycle[j],
        this.expressionCycle[i],
      ];
    }
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
   * Get a random blend factor within the specified range
   */
  private getRandomBlendFactor(range: { min: number; max: number }): number {
    return range.min + Math.random() * (range.max - range.min);
  }

  /**
   * Smooth easing function for transitions
   */
  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ExpressionCycleConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Re-shuffle if randomize order was enabled
    if (newConfig.randomizeOrder && this.config.randomizeOrder) {
      this.shuffleExpressionCycle();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ExpressionCycleConfig {
    return { ...this.config };
  }

  /**
   * Enable or disable expression cycling
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (!enabled) {
      // Clear any active transition and reset to neutral
      this.activeTransition = null;
      this.isTransitioning = false;
      this.clearAllExpressions();
      if (this.expressionManager) {
        const neutralTrackName =
          this.expressionManager.getExpressionTrackName('neutral');
        if (neutralTrackName) {
          this.expressionManager.setValue('neutral', 1.0);
        }
      }
    }
  }

  /**
   * Manual trigger to test a single expression
   */
  public triggerExpression(expression: string, intensity: number = 1.0): void {
    if (!this.expressionManager) return;

    // Map VRM 0.0 names to VRM 1.0 names
    const expressionMap: Record<string, string> = {
      joy: 'happy',
      fun: 'relaxed',
      angry: 'angry',
      sorrow: 'sad',
      neutral: 'neutral',
    };

    const mappedExpression = expressionMap[expression] || expression;

    // Clear all expressions first
    this.clearAllExpressions();

    // Apply the single expression
    const trackName = this.expressionManager.getExpressionTrackName(
      mappedExpression as VRMExpressionPresetName
    );
    if (trackName) {
      this.expressionManager.setValue(
        mappedExpression as VRMExpressionPresetName,
        intensity
      );
      console.log(
        `[ExpressionCycler] Manually triggered: ${expression} (mapped to ${mappedExpression}) with intensity ${intensity}`
      );
    } else {
      console.log(
        `[ExpressionCycler] No track name found for expression: ${mappedExpression} (original: ${expression})`
      );
    }
  }

  /**
   * Debug all available VRM expression shapes
   */
  public debugAllShapes(): void {
    if (!this.expressionManager) {
      console.log('[ExpressionCycler] No expression manager available');
      return;
    }

    console.log('[ExpressionCycler] === VRM Expression Debug ===');

    // Get all available expressions from the VRM
    const expressions = this.expressionManager.expressions || [];
    console.log(
      '[ExpressionCycler] Total expressions found:',
      expressions.length
    );

    // List all expressions with their track names
    expressions.forEach((expr, index) => {
      // Strip VRMExpression_ prefix to get the base name
      const baseName = expr.name.replace('VRMExpression_', '');
      const trackName = this.expressionManager!.getExpressionTrackName(
        baseName as VRMExpressionPresetName
      );
      console.log(
        `[ExpressionCycler] ${index + 1}. ${expr.name} -> Base: ${baseName} -> Track: ${trackName || 'NOT FOUND'}`
      );
    });

    // Test ALL available expressions from the VRM
    console.log('[ExpressionCycler] === Testing ALL Available Expressions ===');

    expressions.forEach((expr, index) => {
      setTimeout(
        () => {
          // Strip VRMExpression_ prefix to get the base name
          const baseName = expr.name.replace('VRMExpression_', '');
          console.log(
            `[ExpressionCycler] Testing ${expr.name} (base: ${baseName})...`
          );

          // Clear all expressions first
          this.clearAllExpressions();

          // Try to set the expression
          const trackName = this.expressionManager!.getExpressionTrackName(
            baseName as VRMExpressionPresetName
          );
          if (trackName) {
            this.expressionManager!.setValue(
              baseName as VRMExpressionPresetName,
              1.0
            );
            console.log(
              `[ExpressionCycler] ✓ SUCCESS: ${expr.name} (${baseName}) -> ${trackName}`
            );
          } else {
            console.log(
              `[ExpressionCycler] ✗ FAILED: ${expr.name} (${baseName}) - No track name found`
            );
          }
        },
        (index + 1) * 1000
      ); // Test each expression 1 second apart
    });

    // Test current values of all expressions
    setTimeout(
      () => {
        console.log('[ExpressionCycler] === Current Expression Values ===');
        expressions.forEach((expr) => {
          const baseName = expr.name.replace('VRMExpression_', '');
          const value = this.expressionManager!.getValue(
            baseName as VRMExpressionPresetName
          );
          console.log(
            `[ExpressionCycler] ${expr.name} (${baseName}): ${value}`
          );
        });
      },
      (expressions.length + 1) * 1000
    );
  }

  /**
   * Get debug information
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDebugInfo(): any {
    return {
      config: this.config,
      expressionCycle: this.expressionCycle,
      currentCycleIndex: this.currentCycleIndex,
      activeTransition: this.activeTransition,
      isTransitioning: this.isTransitioning,
      lastCycleTime: this.lastCycleTime,
      nextCycleDelay: this.nextCycleDelay,
      currentExpression: this.getCurrentExpression(),
      currentIntensity: this.getCurrentExpressionIntensity(),
    };
  }
}

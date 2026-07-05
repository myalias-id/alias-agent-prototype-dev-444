import {
  VRM,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from '@pixiv/three-vrm';
import * as THREE from 'three';

import { AutoBlink } from './autoBlink';
import { AutoLookAt } from './autoLookAt';
import { EmotionStateManager } from './emotionStateManager';
import { ExpressionCycler } from './expressionCycler';
import { ExpressionMovementController } from './expressionMovementController';
import { EyeMovementController } from './eyeMovementController';

/**
 * Expressionを管理するクラス
 *
 * 主に前の表情を保持しておいて次の表情を適用する際に0に戻す作業や、
 * 前の表情が終わるまで待ってから表情適用する役割を持っている。
 */
export class ExpressionController {
  private _autoLookAt: AutoLookAt;
  private _autoBlink?: AutoBlink;
  private _expressionManager?: VRMExpressionManager;
  private _currentEmotion: VRMExpressionPresetName;
  private _emotionStateManager: EmotionStateManager;
  private _eyeMovementController: EyeMovementController;
  private _expressionCycler: ExpressionCycler;
  private _expressionMovementController: ExpressionMovementController;
  private _lipSyncState: {
    fromPreset: VRMExpressionPresetName | null;
    toPreset: VRMExpressionPresetName;
    mix: number; // 0..1 crossfade progress
    transitionSeconds: number;
    value: number; // current loudness mapped from audio
  } | null;
  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._autoLookAt = new AutoLookAt(vrm, camera);
    this._currentEmotion = 'neutral';
    this._lipSyncState = null;

    // Initialize emotion state manager with a clock
    const clock = { getElapsedTime: () => performance.now() / 1000 };
    this._emotionStateManager = new EmotionStateManager(clock);

    // Initialize eye movement controller and expression cycler
    this._eyeMovementController = new EyeMovementController(vrm, clock);
    this._expressionCycler = new ExpressionCycler(vrm, clock);
    this._expressionMovementController = new ExpressionMovementController(
      vrm,
      clock
    );

    if (vrm.expressionManager) {
      this._expressionManager = vrm.expressionManager;
      this._autoBlink = new AutoBlink(vrm.expressionManager);
    }
  }

  public playEmotion(preset: VRMExpressionPresetName) {
    // Update emotion state manager
    this._emotionStateManager.setEmotion(preset);

    // Clear all current expressions first
    this._clearAllExpressions();

    // Keep AutoBlink enabled for all emotions to ensure blinking works during dialogue
    this._autoBlink?.setEnable(true);
    this._currentEmotion = preset;

    // Apply the emotion immediately with modulation
    this._applyEmotionBlend();
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    // Update value every call; only start a new transition if target changes.
    if (!this._lipSyncState) {
      this._lipSyncState = {
        fromPreset: null,
        toPreset: preset,
        mix: 1,
        transitionSeconds: 0.2,
        value,
      };
      return;
    }

    // If target viseme changed, start crossfade
    if (this._lipSyncState.toPreset !== preset) {
      const prevTo = this._lipSyncState.toPreset;
      this._lipSyncState = {
        fromPreset: prevTo,
        toPreset: preset,
        mix: 0,
        transitionSeconds: 0.2,
        value,
      };
      return;
    }

    // Same target, just update current loudness
    this._lipSyncState.value = value;
  }

  public update(delta: number) {
    if (this._autoBlink) {
      this._autoBlink.update(delta);
    }

    // Update eye movements
    this._eyeMovementController.update(delta);

    // If the expression cycler is enabled, let it drive facial expressions.
    // Otherwise, apply the emotion blend from the emotion state manager.
    const cyclerEnabled = this._expressionCycler.getConfig().enabled;
    if (cyclerEnabled) {
      this._expressionCycler.update(delta);
    } else {
      this._applyEmotionBlend();
    }

    // Update subtle expression movements after base expression is set so they layer on top
    this._expressionMovementController.update(delta);

    // Update lip sync
    if (this._lipSyncState) {
      const scale = this._currentEmotion === 'neutral' ? 0.7 : 0.4;

      // Update blendshape turbo with current audio volume
      this._emotionStateManager.updateTurbo(this._lipSyncState.value);

      // Progress crossfade if needed
      if (this._lipSyncState.fromPreset) {
        const duration = Math.max(0.01, this._lipSyncState.transitionSeconds);
        this._lipSyncState.mix = Math.min(
          1,
          this._lipSyncState.mix + delta / duration
        );

        const weightTo =
          this._lipSyncState.value * scale * this._lipSyncState.mix;
        const weightFrom =
          this._lipSyncState.value * scale * (1 - this._lipSyncState.mix);

        this._expressionManager?.setValue(
          this._lipSyncState.fromPreset,
          weightFrom
        );
        this._expressionManager?.setValue(
          this._lipSyncState.toPreset,
          weightTo
        );

        if (this._lipSyncState.mix >= 1) {
          // Clear the previous viseme completely once transition completes
          this._expressionManager?.setValue(this._lipSyncState.fromPreset, 0);
          this._lipSyncState.fromPreset = null;
        }
      } else {
        const weight = this._lipSyncState.value * scale;
        this._expressionManager?.setValue(this._lipSyncState.toPreset, weight);
      }
    }
  }

  /**
   * Reset all mouth shapes to 0 (close mouth)
   */
  public resetMouthShapes(): void {
    if (!this._expressionManager) return;

    // Reset all mouth viseme presets to 0
    const mouthPresets: VRMExpressionPresetName[] = [
      'aa',
      'ih',
      'ou',
      'ee',
      'oh',
    ];

    mouthPresets.forEach((preset) => {
      this._expressionManager?.setValue(preset, 0);
    });

    // Clear lip sync state to prevent it from re-applying values
    this._lipSyncState = null;
  }

  /**
   * Clear all current expressions except blink expressions
   * Blink expressions are managed by AutoBlink and should not be cleared
   */
  private _clearAllExpressions(): void {
    if (!this._expressionManager) return;

    // Reset all expression presets to 0, but preserve blink expressions
    const presets: VRMExpressionPresetName[] = [
      'neutral',
      'happy',
      'angry',
      'sad',
      'relaxed',
      'surprised',
      'aa',
      'ih',
      'ou',
      'ee',
      'oh',
      'lookUp',
      'lookDown',
      'lookLeft',
      'lookRight',
    ];

    presets.forEach((preset) => {
      this._expressionManager?.setValue(preset, 0);
    });

    // Note: blink, blinkLeft, blinkRight are managed by AutoBlink
    // and should not be cleared here
  }

  /**
   * Apply emotion blend with current and previous emotions
   * Note: This method preserves blink expressions managed by AutoBlink
   */
  private _applyEmotionBlend(): void {
    if (!this._expressionManager) return;

    const blend = this._emotionStateManager.getEmotionBlend();

    // Clear all expressions except blink expressions
    this._clearAllExpressions();

    // Apply current emotion
    if (blend.current.emotion !== 'neutral') {
      this._expressionManager.setValue(
        blend.current.emotion,
        blend.current.intensity
      );
    }

    // Apply previous emotion with reduced intensity
    if (
      blend.previous.emotion &&
      blend.previous.emotion !== 'neutral' &&
      blend.previous.intensity > 0
    ) {
      this._expressionManager.setValue(
        blend.previous.emotion,
        blend.previous.intensity
      );
    }

    // Note: AutoBlink continues to manage blink expressions independently
  }

  /**
   * Get the emotion state manager for external configuration
   */
  public getEmotionStateManager(): EmotionStateManager {
    return this._emotionStateManager;
  }

  /**
   * Get the eye movement controller for external configuration
   */
  public getEyeMovementController(): EyeMovementController {
    return this._eyeMovementController;
  }

  /**
   * Get the expression cycler for external configuration
   */
  public getExpressionCycler(): ExpressionCycler {
    return this._expressionCycler;
  }

  /**
   * Get the expression movement controller for external configuration
   */
  public getExpressionMovementController(): ExpressionMovementController {
    return this._expressionMovementController;
  }

  /**
   * Enable or disable eye movements
   */
  public setEyeMovementsEnabled(enabled: boolean): void {
    this._eyeMovementController.updateConfig({
      macroMovementEnabled: enabled,
      microMovementEnabled: enabled,
    });
  }

  /**
   * Enable or disable expression cycling
   */
  public setExpressionCyclingEnabled(enabled: boolean): void {
    this._expressionCycler.setEnabled(enabled);
  }

  /**
   * Set a custom expression cycle
   */
  public setExpressionCycle(
    cycle: {
      expression: string;
      weight?: number;
      duration?: number;
      intensity?: number;
    }[]
  ): void {
    this._expressionCycler.setExpressionCycle(cycle);
  }

  /**
   * Clear all eye movements
   */
  public clearEyeMovements(): void {
    this._eyeMovementController.clearAllMovements();
  }

  /**
   * Enable or disable expression movements
   */
  public setExpressionMovementsEnabled(enabled: boolean): void {
    this._expressionMovementController.updateConfig({
      macroMovementEnabled: enabled,
      microMovementEnabled: enabled,
    });
  }

  /**
   * Clear all expression movements
   */
  public clearExpressionMovements(): void {
    this._expressionMovementController.clearAllMovements();
  }
}

import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import * as THREE from 'three';

import { ExpressionController } from './expressionController';

/**
 * 感情表現としてExpressionとMotionを操作する為のクラス
 * デモにはExpressionのみが含まれています
 */
export class EmoteController {
  private _expressionController: ExpressionController;

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._expressionController = new ExpressionController(vrm, camera);
  }

  public playEmotion(preset: VRMExpressionPresetName) {
    this._expressionController.playEmotion(preset);
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    this._expressionController.lipSync(preset, value);
  }

  public update(delta: number) {
    this._expressionController.update(delta);
  }

  /**
   * Get the emotion state manager for external configuration
   */
  public getEmotionStateManager() {
    return this._expressionController.getEmotionStateManager();
  }

  /**
   * Get the eye movement controller for external configuration
   */
  public getEyeMovementController() {
    return this._expressionController.getEyeMovementController();
  }

  /**
   * Get the expression cycler for external configuration
   */
  public getExpressionCycler() {
    return this._expressionController.getExpressionCycler();
  }

  /**
   * Enable or disable eye movements
   */
  public setEyeMovementsEnabled(enabled: boolean): void {
    this._expressionController.setEyeMovementsEnabled(enabled);
  }

  /**
   * Enable or disable expression cycling
   */
  public setExpressionCyclingEnabled(enabled: boolean): void {
    this._expressionController.setExpressionCyclingEnabled(enabled);
  }

  /**
   * Set a custom expression cycle
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setExpressionCycle(cycle: any[]): void {
    this._expressionController.setExpressionCycle(cycle);
  }

  /**
   * Clear all eye movements
   */
  public clearEyeMovements(): void {
    this._expressionController.clearEyeMovements();
  }

  /**
   * Get the expression movement controller for external configuration
   */
  public getExpressionMovementController() {
    return this._expressionController.getExpressionMovementController();
  }

  /**
   * Enable or disable expression movements
   */
  public setExpressionMovementsEnabled(enabled: boolean): void {
    this._expressionController.setExpressionMovementsEnabled(enabled);
  }

  /**
   * Clear all expression movements
   */
  public clearExpressionMovements(): void {
    this._expressionController.clearExpressionMovements();
  }

  /**
   * Manually trigger a single expression for testing
   */
  public triggerExpression(expression: string, intensity: number = 1.0): void {
    this._expressionController
      .getExpressionCycler()
      .triggerExpression(expression, intensity);
  }

  /**
   * Debug all available VRM expression shapes
   */
  public debugAllShapes(): void {
    this._expressionController.getExpressionCycler().debugAllShapes();
  }

  /**
   * Reset all mouth shapes to 0 (close mouth)
   */
  public resetMouthShapes(): void {
    this._expressionController.resetMouthShapes();
  }
}

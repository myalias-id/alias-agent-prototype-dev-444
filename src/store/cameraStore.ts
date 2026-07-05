import * as THREE from 'three';
import { create } from 'zustand';

/**
 * @file This file contains the Zustand store for managing the state of the main 3D camera.
 * It tracks the camera object itself, its controls, its base position, and whether it has been moved
 * by the user, allowing for features like resetting the camera view.
 */

/**
 * Minimal interface for the OrbitControls instance. Typed here to avoid
 * importing the full @react-three/drei component type and the `@ts-expect-error`
 * workarounds it previously required.
 */
interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
}

/**
 * Defines the state and actions for the camera store.
 */
interface CameraStoreState {
  /** The current Three.js Camera object instance. */
  camera: THREE.Camera | null;
  /** The `OrbitControls` instance used to control the camera. */
  cameraControls: OrbitControlsLike | null;
  /** A boolean flag that is true if the camera has been moved from its default position. */
  cameraMoved: boolean;
  /** A boolean flag to enable or disable the camera controls. */
  enabled: boolean;
  /** A flag to indicate if the initial camera state has been saved. */
  stateSaved: boolean;
  /** A toggle that can be used to trigger a camera reset. */
  toggleReset: boolean;
  /** The default, initial position of the camera. */
  cameraBasePosition: THREE.Vector3;
  /** The default, initial target (look-at point) of the camera. */
  cameraTargetPosition: THREE.Vector3;
  /** Sets the camera instance in the store. */
  setCamera: (camera: THREE.Camera) => void;
  /** Sets the camera controls instance in the store. */
  setCameraControls: (controls: OrbitControlsLike | null) => void;
  /** Sets the base (default) position of the camera. */
  setCameraBasePosition: (position: THREE.Vector3) => void;
  /** Sets the base (default) target of the camera. */
  setCameraTargetPosition: (position: THREE.Vector3) => void;
  /** Resets the camera to its initial position and target. */
  resetCamera: () => void;
  /** Toggles the enabled state of the camera controls. */
  toggleCameraControls: (enabled?: boolean) => void;
  /** Checks if the camera has moved from its base position/target and updates the `cameraMoved` flag. */
  checkCameraMoved: () => void;
}

const NullVector = new THREE.Vector3(0, 0, 0);

/**
 * Zustand store for managing the application's 3D camera state.
 * @see {@link CameraStoreState}
 */
const useCameraStore = create<CameraStoreState>((set, get) => ({
  camera: null,
  cameraControls: null,
  cameraMoved: false,
  enabled: true,
  stateSaved: false,
  toggleReset: false,
  cameraBasePosition: NullVector.clone(),
  cameraTargetPosition: NullVector.clone(),
  setCamera: (camera) => set({ camera }),
  setCameraControls: (controls) => set({ cameraControls: controls }),
  setCameraBasePosition: (position) => set({ cameraBasePosition: position }),
  setCameraTargetPosition: (position) =>
    set({ cameraTargetPosition: position }),
  resetCamera: () => {
    set((state) => {
      if (state.cameraControls && state.camera) {
        state.cameraControls.enableDamping = false;
        state.cameraControls.target.copy(state.cameraTargetPosition);
        state.camera.position.copy(state.cameraBasePosition);
        state.cameraControls.update();
        state.cameraControls.enableDamping = true;
        return { cameraMoved: false };
      }
      return {};
    });
  },
  toggleCameraControls: (enabled?: boolean) => {
    set((state) => {
      const newEnabled = enabled !== undefined ? enabled : !state.enabled;
      if (state.cameraControls) {
        state.cameraControls.enabled = newEnabled;
      }
      return { enabled: newEnabled };
    });
  },
  checkCameraMoved: () => {
    const { camera, cameraBasePosition, cameraTargetPosition, cameraControls } =
      get();
    if (camera && cameraControls) {
      const cameraMoved =
        !camera.position.equals(cameraBasePosition) ||
        !cameraControls.target.equals(cameraTargetPosition);
      set({ cameraMoved });
    }
  },
}));

export default useCameraStore;

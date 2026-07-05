import { create } from 'zustand';

import { AnimationSmoothingConfig } from '@/components/vrm/animationSmoother';

interface AnimationSmoothingStoreState {
  config: AnimationSmoothingConfig;
  isDebugPanelVisible: boolean;
  updateConfig: (newConfig: Partial<AnimationSmoothingConfig>) => void;
  setDebugPanelVisible: (visible: boolean) => void;
  resetConfig: () => void;
}

const defaultConfig: AnimationSmoothingConfig = {
  enabled: true,
  targetFrameRate: 8, // More dramatic default
  interpolationMethod: 'smoothstep',
  smoothingStrength: 0.9, // Higher smoothing strength
  maxInterpolationFrames: 10,
};

export const useAnimationSmoothingStore = create<AnimationSmoothingStoreState>(
  (set, _get) => ({
    config: defaultConfig,
    isDebugPanelVisible: false,

    updateConfig: (newConfig) => {
      set((state) => ({
        config: { ...state.config, ...newConfig },
      }));
    },

    setDebugPanelVisible: (visible) => {
      set({ isDebugPanelVisible: visible });
    },

    resetConfig: () => {
      set({ config: defaultConfig });
    },
  })
);

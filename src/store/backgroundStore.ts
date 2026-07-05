import { create } from 'zustand';

import { IBgProps } from '@/types/agent';

/**
 * @file This file contains the Zustand store for managing the application's background state.
 * It holds the list of all available backgrounds, the user-unlocked backgrounds, and the
 * currently active background being displayed in the canvas.
 */

/**
 * Defines the state and actions for the background store.
 */
interface BackgroundStoreState {
  /** A list of all background options available in the application. */
  allBackgrounds: IBgProps[];
  /** A filtered list of backgrounds that the current user has access to. */
  userAvailableBackgrounds: IBgProps[];
  /** The background object that is currently selected and displayed. Null if none is selected. */
  currentBackground: IBgProps | null;
  /** A trigger value that can be incremented to force a re-fetch of background data. */
  fetchUpdateTrigger: number;
  /** Sets the complete list of all available backgrounds. */
  setAllBackgrounds: (backgrounds: IBgProps[]) => void;
  /** Sets the list of backgrounds available to the current user. */
  setUserAvailableBackgrounds: (backgrounds: IBgProps[]) => void;
  /** Sets the specified background as the currently active one. */
  setCurrentBackground: (background: IBgProps) => void;
  /** Increments the fetch trigger to signal that background data should be refreshed. */
  triggerFetchBackgrounds: () => void;
}

/**
 * A default set of chroma key background options.
 */
export const chromaBgs: Partial<IBgProps>[] = [
  {
    id: -1, // set-automatically
    name: 'Chroma Key Green',
    description: `Use Chroma Key to add your own backgrounds in editing software`,
    unlockedByDefault: true,
    bgConfig: {
      type: 'Chroma',
      color: '#00FF00',
    },
  },
  {
    id: -1, // set-automatically
    name: 'Chroma Key Blue',
    description: `Use Chroma Key to add your own backgrounds in editing software`,
    unlockedByDefault: true,
    bgConfig: {
      type: 'Chroma',
      color: '#0000FF',
    },
  },
];

/**
 * Zustand store for managing the application's background state.
 * @see {@link BackgroundStoreState}
 */
const useBackgroundStore = create<BackgroundStoreState>((set) => ({
  allBackgrounds: [],
  userAvailableBackgrounds: [],
  currentBackground: null,
  fetchUpdateTrigger: 0,

  setAllBackgrounds: (backgrounds) => set({ allBackgrounds: backgrounds }),
  setUserAvailableBackgrounds: (backgrounds) =>
    set({ userAvailableBackgrounds: backgrounds }),
  setCurrentBackground: (background) => set({ currentBackground: background }),
  triggerFetchBackgrounds: () =>
    set((state) => ({ fetchUpdateTrigger: state.fetchUpdateTrigger + 1 })),
}));

export default useBackgroundStore;

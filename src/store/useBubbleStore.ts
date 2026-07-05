// useBubbleStore.ts
import { CSSProperties, ReactNode } from 'react';
import { create } from 'zustand';

import { MAX_BUBBLES } from '@/lib/constants';

/**
 * @file This file contains the Zustand store for managing on-screen chat bubbles.
 * These bubbles are temporary visual elements that display messages in the 3D scene.
 */

/**
 * Represents a single chat bubble with its content and metadata.
 */
export interface Bubble {
  /** A unique identifier for the bubble. */
  id: number;
  /** The content to be displayed, which can be any React node. */
  content: ReactNode;
  /** The timestamp of when the bubble was created. */
  createdAt: number;
  /** Optional inline CSS styles for the bubble. */
  style?: CSSProperties;
}

/**
 * Defines the state and actions for the bubble store.
 */
interface BubbleStore {
  /** An array of the currently active bubbles. */
  bubbles: Bubble[];
  /** Adds a new bubble to the store. If the maximum number of bubbles is reached, the oldest one is removed. */
  addBubble: (content: ReactNode, style?: CSSProperties) => void;
  /** Removes a bubble from the store by its ID. */
  removeBubble: (id: number) => void;
}

let bubbleIdCounter = 0;

/**
 * Zustand store for managing chat bubbles.
 * @see {@link BubbleStore}
 */
const useBubbleStore = create<BubbleStore>((set, _get) => ({
  bubbles: [],
  addBubble: (content, style) =>
    set((state) => {
      const id = bubbleIdCounter++;
      const newBubble: Bubble = { id, content, createdAt: Date.now(), style };

      // Enforce a maximum number of bubbles on screen.
      if (state.bubbles.length >= MAX_BUBBLES) {
        return {
          bubbles: [...state.bubbles.slice(1), newBubble],
        };
      }

      return { bubbles: [...state.bubbles, newBubble] };
    }),
  removeBubble: (id) =>
    set((state) => ({
      bubbles: state.bubbles.filter((bubble) => bubble.id !== id),
    })),
}));

export default useBubbleStore;

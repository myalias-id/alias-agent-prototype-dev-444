'use client';

import React, { CSSProperties, useEffect, useRef } from 'react';

import { Bubble } from '@/store/useBubbleStore';

/**
 * @file This file contains the `BubbleDiv` component, which is the visual representation
 * of a single chat bubble. It handles its own fade-out and removal animation.
 */
interface BubbleDivProps {
  /** The bubble data object from the store. */
  bubble: Bubble;
  /** A callback function to remove the bubble from the store once it has faded out. */
  onRemove: () => void;
  /** Optional inline styles to apply to the bubble's div. */
  style?: CSSProperties;
}

/**
 * A presentational component that renders a single chat bubble.
 * It uses a `useEffect` hook to manage its lifecycle: it fades in, waits for a
 * set duration, then fades out and calls the `onRemove` callback.
 * It is memoized with `React.memo` for performance, preventing re-renders
 * unless its props change.
 *
 * @param {BubbleDivProps} props - The component's props.
 */
const BubbleDiv: React.FC<BubbleDivProps> = React.memo(
  ({ bubble, onRemove, style }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const duration = 10000; // Total lifetime of the bubble in milliseconds.

    // This effect controls the fade-in, fade-out, and removal of the bubble.
    useEffect(() => {
      if (divRef.current) {
        // Start the fade-in transition.
        divRef.current.style.opacity = '1';
        divRef.current.style.transition = `opacity 1s ease`;

        // Set a timeout to start fading out 1 second before the end of its life.
        const fadeOutTimeout = setTimeout(() => {
          if (divRef.current) {
            divRef.current.style.opacity = '0';
          }
        }, duration - 1000);

        // Set a timeout to call the removal callback after the fade-out is complete.
        const removeTimeout = setTimeout(() => {
          onRemove();
        }, duration);

        // Cleanup function to clear timeouts if the component unmounts prematurely.
        return () => {
          clearTimeout(fadeOutTimeout);
          clearTimeout(removeTimeout);
        };
      }
    }, [onRemove, duration]);

    return (
      <div
        ref={divRef}
        style={{
          ...style,
          opacity: 1, // Start with full opacity for the fade-in effect to work correctly.
          transition: 'opacity 1s ease',
        }}>
        {/* eslint-disable-next-line react/prop-types */}
        {bubble.content}
      </div>
    );
  },

  // Custom comparison function for React.memo to prevent unnecessary re-renders.
  (prevProps, nextProps) => {
    return (
      prevProps.bubble.id === nextProps.bubble.id &&
      prevProps.bubble.content === nextProps.bubble.content &&
      JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style)
    );
  }
);

BubbleDiv.displayName = 'BubbleDiv';

export { BubbleDiv };

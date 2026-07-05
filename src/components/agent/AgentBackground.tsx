'use client';

import Image from 'next/image';

import useBackgroundStore from '@/store/backgroundStore';

/**
 * Renders the current background (Static, 360, or Chroma) in a fullscreen div
 * behind all content.
 */
export default function AgentBackground() {
  const currentBackground = useBackgroundStore(
    (state) => state.currentBackground
  );

  if (!currentBackground) {
    // If no background is chosen, render nothing
    return null;
  }

  // For now, we'll handle only the Static type for demonstration.
  // Extend with other logic (360, Chroma, etc.) if needed.
  if (currentBackground.bgConfig?.type === 'Static') {
    return (
      <div className="fixed top-0 left-0 w-full h-full z-[-1] overflow-hidden">
        <Image
          src={currentBackground.image?.url || ''}
          alt="Background"
          fill
          className="object-contain"
          quality={90}
          priority
        />
      </div>
    );
  }

  // Fallback for other background types: you might choose to return null or do something else
  return null;
}

'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * @file This component sets a solid color background for the Three.js scene,
 * primarily intended for chroma keying (e.g., green screen or blue screen effects).
 */

/**
 * Sets the background of the Three.js scene to a solid color.
 * This is useful for creating a "green screen" effect, allowing creators to easily
 * key out the background in video editing software.
 *
 * @param {object} props - The component's props.
 * @param {string} props.color - The CSS color string (e.g., '#00ff00', 'blue') to use for the background.
 * @returns {null} This component does not render any geometry; it modifies the scene directly.
 */
export function BackgroundChromaKey({ color }: { color: string }) {
  const { scene } = useThree();

  // This effect updates the scene's background color whenever the `color` prop changes.
  useEffect(() => {
    if (!color || color === '') return;

    scene.background = new THREE.Color(color);

    // Cleanup function to reset the background when the component unmounts.
    return () => {
      scene.background = null;
    };
  }, [scene, color]);

  return <></>;
}

'use client';

import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { disposeOfTexture } from '@/lib/utils/garbage-collection';

/**
 * @file This component renders a static 2D image as the background of the Three.js scene.
 * It intelligently handles aspect ratio differences between the image and the canvas to ensure
 * the image covers the entire background without distortion, similar to the CSS `background-size: cover` property.
 */

/**
 * Renders a static image as the scene background.
 *
 * This component loads the specified image URL as a texture and sets it as the `scene.background`.
 * It contains logic to calculate the correct texture offset and repeat properties to ensure the
 * image always covers the canvas area without being stretched or squished, regardless of window size.
 *
 * @param {object} props - The component's props.
 * @param {string} props.imageUrl - The URL of the image to display as the background.
 * @returns {null} This component does not render any visible mesh; it manipulates the scene directly.
 */
export function BackgroundImageCanvas({ imageUrl }: { imageUrl: string }) {
  const { scene, gl, invalidate } = useThree();
  imageUrl = imageUrl ? imageUrl : '/img/Arcade.webp';
  // Immediately set the ref to the current texture, moved from useEffect cleanup
  const texture = useTexture(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const prevTextureRef = useRef<THREE.Texture | null>(null); // Initialize with null

  if (prevTextureRef.current && prevTextureRef.current !== texture) {
    // Dispose of the previous texture right away if it's different from the current one
    disposeOfTexture(prevTextureRef.current, false);
  }
  prevTextureRef.current = texture; // Update the ref to the current texture

  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  // This effect applies the background and sets up a ResizeObserver to handle window resizing.
  useEffect(() => {
    /**
     * Calculates and applies the correct texture transformations to maintain aspect ratio (contain effect).
     */
    const updateBackground = () => {
      if (!texture.image || !texture.image.complete) return;

      const canvasWidth = gl.domElement.clientWidth;
      const canvasHeight = gl.domElement.clientHeight;

      if (canvasWidth === 0 || canvasHeight === 0) return;

      const canvasAspect = canvasWidth / canvasHeight;
      const imageAspect = texture.image.width / texture.image.height;
      const aspect = imageAspect / canvasAspect;

      // "Cover" effect: scale from center so the image always fills the canvas,
      // cropping the excess. repeat < 1 zooms in, offset centers the crop.
      if (aspect > 1) {
        texture.repeat.x = 1 / aspect;
        texture.repeat.y = 1;
        texture.offset.x = (1 - 1 / aspect) / 2;
        texture.offset.y = 0;
      } else {
        texture.repeat.x = 1;
        texture.repeat.y = aspect;
        texture.offset.x = 0;
        texture.offset.y = (1 - aspect) / 2;
      }

      scene.background = texture;
      scene.backgroundIntensity = 1;
      invalidate(); // Force a re-render in @react-three/fiber
    };

    // Initial setup
    if (texture.image?.complete) {
      updateBackground();
    } else {
      texture.image.onload = updateBackground;
    }

    // Set up ResizeObserver to handle window resizing
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        updateBackground();
      });
    });
    observer.observe(gl.domElement);

    // Also listen to window resize as a fallback
    const handleResize = () => {
      requestAnimationFrame(() => {
        updateBackground();
      });
    };
    window.addEventListener('resize', handleResize);

    // Cleanup function to disconnect the observer and dispose of the texture.
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      scene.background = null;

      if (texture) {
        disposeOfTexture(texture, false);
      }
    };
  }, [gl.domElement, scene, texture, imageUrl, invalidate]);

  return null;
}

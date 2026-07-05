'use client';

import { useFrame, useLoader, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { disposeOfTexture } from '@/lib/utils/garbage-collection';
import { IBgProps } from '@/types/agent';

/**
 * @file Renders a 360-degree panoramic background within the Three.js scene.
 * This component creates a sphere with an equirectangular texture and allows the user
 * to click and drag to rotate the view, with a smooth, velocity-based inertia effect.
 */

/**
 * Interface representing 2D coordinates for pointer events.
 */
interface Position {
  x: number;
  y: number;
}

/**
 * Renders a 360-degree background sphere in a Three.js scene. It loads an
 * equirectangular texture and maps it to the inside of a large sphere. The component
 * sets up event listeners on the canvas to allow users to drag and rotate the sphere.
 *
 * @param {object} props - The component's props.
 * @param {IBgProps} props.currentBackground - An object containing the configuration for the current background, including the image URL.
 */
export function Background360({
  currentBackground,
}: {
  currentBackground: IBgProps;
}) {
  const { scene, gl } = useThree();
  const texture = useLoader(THREE.TextureLoader, currentBackground.image?.url);
  const sphereRef = useRef<THREE.Mesh>(null);
  const isDragging = useRef(false);
  const dragPosition = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });

  const prevTextureRef = useRef<THREE.Texture | null>(null);

  // Configure the texture for equirectangular mapping.
  texture.minFilter = THREE.LinearFilter;
  texture.mapping = THREE.EquirectangularReflectionMapping;

  // Effect to apply the texture to the scene's background property for reflections and lighting.
  useEffect(() => {
    if (prevTextureRef.current) {
      disposeOfTexture(prevTextureRef.current, false);
    }
    scene.background = texture;
    prevTextureRef.current = texture;

    return () => {
      if (texture) {
        disposeOfTexture(texture, false);
      }
      scene.background = null;
    };
  }, [texture, scene]);

  // Effect to set up and clean up event listeners for dragging.
  useEffect(() => {
    const canvas = gl.domElement;

    const getEventPosition = (event: PointerEvent | TouchEvent): Position => {
      if ('touches' in event && event.touches.length) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      } else if ('clientX' in event) {
        return { x: event.clientX, y: event.clientY };
      }
      return { x: 0, y: 0 };
    };

    const onPointerDown = (event: PointerEvent | TouchEvent) => {
      event.preventDefault();
      isDragging.current = true;
      const position = getEventPosition(event);
      dragPosition.current = position;
      lastPosition.current = { ...position };
      velocity.current = { x: 0, y: 0 };
    };

    const onPointerMove = (event: PointerEvent | TouchEvent) => {
      if (isDragging.current) {
        const position = getEventPosition(event);
        const deltaX = position.x - dragPosition.current.x;
        const deltaY = position.y - dragPosition.current.y;
        dragPosition.current = position;
        velocity.current = { x: deltaX, y: deltaY };
      }
    };

    const onPointerUp = () => {
      isDragging.current = false;
    };

    // Add event listeners
    canvas.addEventListener('pointerdown', onPointerDown as EventListener, {
      passive: false,
    });
    canvas.addEventListener('pointermove', onPointerMove as EventListener, {
      passive: false,
    });
    canvas.addEventListener('pointerup', onPointerUp as EventListener, {
      passive: false,
    });
    canvas.addEventListener('pointerleave', onPointerUp as EventListener, {
      passive: false,
    });
    canvas.addEventListener('touchstart', onPointerDown as EventListener, {
      passive: false,
    });
    canvas.addEventListener('touchmove', onPointerMove as EventListener, {
      passive: false,
    });
    canvas.addEventListener('touchend', onPointerUp as EventListener, {
      passive: false,
    });
    canvas.addEventListener('touchcancel', onPointerUp as EventListener, {
      passive: false,
    });

    // Clean up event listeners
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown as EventListener);
      canvas.removeEventListener('pointermove', onPointerMove as EventListener);
      canvas.removeEventListener('pointerup', onPointerUp as EventListener);
      canvas.removeEventListener('pointerleave', onPointerUp as EventListener);
      canvas.removeEventListener('touchstart', onPointerDown as EventListener);
      canvas.removeEventListener('touchmove', onPointerMove as EventListener);
      canvas.removeEventListener('touchend', onPointerUp as EventListener);
      canvas.removeEventListener('touchcancel', onPointerUp as EventListener);
    };
  }, [gl.domElement]);

  // Frame loop to apply rotation and inertia.
  useFrame(() => {
    if (sphereRef.current) {
      // Apply inertia when not dragging.
      if (
        !isDragging.current &&
        (velocity.current.x !== 0 || velocity.current.y !== 0)
      ) {
        dragPosition.current.x += velocity.current.x;
        dragPosition.current.y += velocity.current.y;
        velocity.current.x *= 0.93; // Damping factor
        velocity.current.y *= 0.93; // Damping factor
      }

      const rotationDelta = {
        x: (dragPosition.current.y - lastPosition.current.y) * 0.001,
        y: (dragPosition.current.x - lastPosition.current.x) * 0.001,
      };
      // Apply rotation to the sphere mesh.
      sphereRef.current.rotation.y -= rotationDelta.y;
      sphereRef.current.rotation.x -= rotationDelta.x;

      lastPosition.current = { ...dragPosition.current };
    }
  });

  return <BackgroundSphere ref={sphereRef} texture={texture} />;
}

/**
 * A memoized React component that renders a Three.js mesh for the background sphere.
 * It's forward-refed to allow the parent component to directly manipulate the mesh.
 * @param {object} props - The component props.
 * @param {THREE.Texture} props.texture - The texture to apply to the sphere.
 * @param {React.Ref<THREE.Mesh>} ref - The forwarded ref.
 */
const BackgroundSphere = React.forwardRef<
  THREE.Mesh,
  { texture: THREE.Texture }
>(({ texture }, ref) => {
  return (
    <mesh ref={ref} scale={[1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
});

BackgroundSphere.displayName = 'BackgroundSphere';

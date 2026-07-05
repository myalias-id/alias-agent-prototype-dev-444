/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Html } from '@react-three/drei';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { BubbleDiv } from '@/components/canvas/bubble-div';
import useVRMStore from '@/store/vrmStore';

import useBubbleStore from '../../store/useBubbleStore';

/**
 * @file This component is responsible for rendering chat bubbles in the 3D scene.
 * It attaches them to the VRM model's head so they follow its movements.
 */

/**
 * Renders chat messages from the `useBubbleStore` as floating HTML elements in the 3D scene.
 * It creates a `THREE.Group`, attaches it to the VRM's head bone (obtained from `useVRMStore`),
 * and then uses the `@react-three/drei` `Html` component to project regular React components
 * (`BubbleDiv`) into the WebGL canvas.
 */
export function FloatingBubbles() {
  const { bubbles, removeBubble } = useBubbleStore();
  const headBone = useVRMStore((state) => state.headBone);
  const groupRef = useRef<THREE.Group>(new THREE.Group());

  // This effect attaches the bubble container group to the VRM's head bone.
  // When the head moves, the group (and all the bubbles inside it) will move with it.
  useEffect(() => {
    if (headBone && groupRef.current) {
      headBone.add(groupRef.current);

      // Offset the group slightly from the head's center.
      groupRef.current.position.set(0.3, 0, 0);

      // Cleanup function to remove the group when the component unmounts or the head bone changes.
      return () => {
        headBone.remove(groupRef.current);
      };
    }
  }, [headBone]);

  if (!headBone) return null;

  return (
    <group ref={groupRef}>
      {/* The `Html` component from R3F/Drei is used to render DOM elements in the 3D scene. */}
      <Html transform={true} scale={0.1}>
        <div
          style={{
            position: 'relative',
            height: 0,
            overflow: 'visible',
          }}>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
            }}>
            {bubbles.map((bubble) => (
              <BubbleDiv
                key={bubble.id}
                bubble={bubble}
                onRemove={() => removeBubble(bubble.id)}
                style={bubble.style}
              />
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
}

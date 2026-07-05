/* eslint-disable */
'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import * as THREE from 'three';
import { Vector3 } from 'three';

import { Background360 } from '@/components/canvas/background-360';
import { BackgroundImageCanvas } from '@/components/canvas/background-image-canvas';
import { FloatingBubbles } from '@/components/canvas/floating-bubbles';
import useBackgroundStore from '@/store/backgroundStore';
import useCameraStore from '@/store/cameraStore';
import useVRMStore from '@/store/vrmStore';

import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import { BackgroundChromaKey } from './background-chroma-key';

/**
 * @file This file defines the main Three.js canvas for the application, setting up the scene, camera, lighting, and post-processing effects. It acts as the root container for all 3D content.
 */

interface MainCanvasProps {
  children?: React.ReactNode;
  /** Additional CSS classes for styling the canvas element */
  className?: string;
  /** 3D x-axis offset from the VRM's head position */
  xOffset?: number;
  /** 3D y-axis offset from the VRM's head position */
  yOffset?: number;
  /** 3D z-axis offset from the VRM's head position */
  zOffset?: number;
  /**
   * Field-of-view for the perspective camera.
   * (Default: 45 degrees)
   */
  cameraFov?: number;
  xCamAndOrbitOffset?: number;
  yCamAndOrbitOffset?: number;
  zCamAndOrbitOffset?: number;
  xCamAndOrbitOffsetMobile?: number;
  yCamAndOrbitOffsetMobile?: number;
  zCamAndOrbitOffsetMobile?: number;
}

/**
 * A subcomponent responsible for positioning the camera relative to the VRM model's head.
 * It updates the camera's position and projection matrix whenever the VRM model or camera properties change.
 * @param {object} props - The component props.
 * @param {number} [props.xOffset=0] - The x-axis offset from the VRM's eye position.
 * @param {number} [props.yOffset=0] - The y-axis offset from the VRM's eye position.
 * @param {number} [props.zOffset=0] - The z-axis offset from the VRM's eye position.
 * @param {number} [props.cameraFov=45] - The field of view for the camera.
 */
function SetCameraPos({
  xOffset = 0,
  yOffset = 0,
  zOffset = 0,
  cameraFov = 45,
}: {
  xOffset?: number;
  yOffset?: number;
  zOffset?: number;
  cameraFov?: number;
}) {
  const { camera } = useThree();
  const currentVRM = useVRMStore((state) => state.currentVRM);

  useEffect(() => {
    // Reset camera position and look at center
    camera.position.set(0, 0, zOffset || 0);
    camera.lookAt(new Vector3(0, 0, 0));
    // When cameraFov changes, update camera
    //@ts-expect-error fov
    camera.fov = cameraFov;
    camera.updateProjectionMatrix();
  }, [camera, cameraFov, zOffset]);

  useEffect(() => {
    if (!currentVRM) return;

    // "eyesPosition" is stored in VRM store
    const eyePosition = currentVRM.eyesPosition;

    const cameraBasePosition = new THREE.Vector3(
      eyePosition.x + xOffset,
      eyePosition.y + yOffset,
      eyePosition.z + zOffset
    );
    camera.position.copy(cameraBasePosition);
  }, [currentVRM, camera, xOffset, yOffset, zOffset]);

  return null;
}

/**
 * MainCanvas is the primary `@react-three/fiber` component that renders the 3D scene.
 * It is responsible for:
 * - Setting up the Three.js Canvas and WebGL renderer.
 * - Configuring lighting, camera controls (`OrbitControls`), and post-processing effects.
 * - Dynamically rendering the correct background (Static, 360, or Chroma Key) based on global state.
 * - Acting as a container for all other 3D elements, such as the VRM model, which are passed as `children`.
 * @param {MainCanvasProps} props - The component props.
 * @param {React.Ref<HTMLCanvasElement>} ref - Forwarded ref to the underlying canvas element.
 */
export const MainCanvas = forwardRef<HTMLCanvasElement, MainCanvasProps>(
  (
    {
      children,
      className,
      xOffset = 0,
      yOffset = 0,
      zOffset = 0,
      cameraFov = 45,
      xCamAndOrbitOffset = 0,
      yCamAndOrbitOffset = 0,
      zCamAndOrbitOffset = 0,
    },
    ref
  ) => {
    const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
    useImperativeHandle(ref, () => internalCanvasRef.current!);

    const currentBackground = useBackgroundStore(
      (state) => state.currentBackground
    );

    const orbitControlsRef = useRef<any>(null);

    const currentVRM = useVRMStore((state) => state.currentVRM);
    const setCameraControls = useCameraStore(
      (state) => state.setCameraControls
    );
    const checkCameraMoved = useCameraStore((state) => state.checkCameraMoved);
    const orbitEnabled = useCameraStore((state) => state.enabled);

    useEffect(() => {
      if (orbitControlsRef.current) {
        setCameraControls(orbitControlsRef.current);
      }
    }, [orbitControlsRef.current, setCameraControls]);

    useEffect(() => {
      const handlePointerDown = (event: PointerEvent) => {
        if (!orbitControlsRef) return;
        if (orbitControlsRef.current === null) return;

        if (event.target instanceof HTMLCanvasElement) {
          orbitControlsRef.current.enabled = true;
        } else {
          orbitControlsRef.current.enabled = false;
        }
      };
      window.addEventListener('pointerdown', handlePointerDown);
      return () => {
        window.removeEventListener('pointerdown', handlePointerDown);
      };
    }, []);

    return (
      <Canvas
        dpr={[1, 1.5]}
        ref={internalCanvasRef}
        className={`w-full h-full absolute rounded-[10px] inset-0 z-0 ${className || ''}`}
        onCreated={({ gl, scene }) => {
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        }}
        style={{ pointerEvents: 'all' }}
        eventSource={document.body}
        eventPrefix="client">
        {/* BACKGROUND LOGIC */}
        {currentBackground?.bgConfig?.type === 'Static' && (
          <BackgroundImageCanvas imageUrl={currentBackground?.image?.url} />
        )}
        {currentBackground?.bgConfig?.type === '360' && (
          <Background360 currentBackground={currentBackground} />
        )}
        {currentBackground?.bgConfig?.type === 'Chroma' && (
          <BackgroundChromaKey
            color={currentBackground?.bgConfig?.color || '#0f0'}
          />
        )}
        {/* ORBIT CONTROLS */}
        <OrbitControls
          ref={orbitControlsRef}
          target={
            new THREE.Vector3(
              xCamAndOrbitOffset,
              yCamAndOrbitOffset,
              zCamAndOrbitOffset
            )
          }
          rotateSpeed={0.5}
          panSpeed={0}
          enablePan={false}
          enableZoom={false}
          enableRotate={false}
          enabled={orbitEnabled}
          onChange={() => checkCameraMoved()}
        />
        {/* APPLY OUR camera offset + fov */}
        <SetCameraPos
          xOffset={xOffset}
          yOffset={yOffset}
          zOffset={zOffset}
          cameraFov={cameraFov}
        />
        <ambientLight intensity={0.5} />
        {/*key light*/}
        <pointLight
          intensity={60}
          position={[1.9, 5, 3]}
          castShadow={true}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {/*Rim light*/}
        <pointLight
          intensity={0}
          position={[1, 2.5, -2]}
          castShadow={true}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          color={0xe5e6b3}
        />
        {/* VRM / children */}
        {children}
        <EffectComposer>
          <N8AO aoSamples={31} aoRadius={0.15} intensity={1} />
          <Bloom
            intensity={0}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.05}
            mipmapBlur
          />
          {/* <Vignette eskil={false} offset={0.2} darkness={0.8} /> */}
        </EffectComposer>
        <FloatingBubbles />
      </Canvas>
    );
  }
);

MainCanvas.displayName = 'MainCanvas';

'use client';

import {
  VRM,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from '@pixiv/three-vrm';
import { signal } from '@preact/signals-react';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

import { getVRMBlendShapeType } from '@/hooks/useVrmInitializer';
import { disposeOfModel } from '@/lib/utils/garbage-collection';
import { useAnimationSmoothingStore } from '@/store/animationSmoothingStore';
import useAgentStore from '@/store/useAgentStore';
import useVRMStore, { AdditionalVrmProps } from '@/store/vrmStore';

import { BoneAnimationSmoother } from './boneAnimationSmoother';
import { EmoteController } from './emoteController/emoteController';
import { Model } from './Model';
import RotatableModel from './RotatableModel';
import { VRMLookAtSmootherLoaderPlugin } from './VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin';

interface IModelCache {
  [key: string]: VRM;
}

const MAX_MODEL_CACHE_ENTRIES = 3;
const modelCache = new Map<string, VRM>();

export const modelCacheSignal = signal<IModelCache>({});

const syncModelCacheSignal = () => {
  modelCacheSignal.value = Object.fromEntries(modelCache);
};

const disposeCachedVrm = (vrm: VRM) => {
  disposeOfModel(vrm);
};

const getCachedModel = (url: string): VRM | undefined => {
  const cached = modelCache.get(url);
  if (!cached) return undefined;

  modelCache.delete(url);
  modelCache.set(url, cached);
  syncModelCacheSignal();
  return cached;
};

const cacheModel = (url: string, vrm: VRM) => {
  if (modelCache.has(url)) {
    modelCache.delete(url);
  }

  modelCache.set(url, vrm);

  while (modelCache.size > MAX_MODEL_CACHE_ENTRIES) {
    const oldestUrl = modelCache.keys().next().value;
    if (!oldestUrl) break;

    const oldestVrm = modelCache.get(oldestUrl);
    modelCache.delete(oldestUrl);
    if (oldestVrm) {
      disposeCachedVrm(oldestVrm);
    }
  }

  syncModelCacheSignal();
};

const loadModel = async (
  url: string,
  abortSignal: AbortSignal,
  onProgress?: (progress: number) => void
): Promise<VRM | null> => {
  const cachedModel = getCachedModel(url);
  if (cachedModel) {
    return cachedModel;
  }

  const loader = new GLTFLoader();
  loader.register(
    (parser) =>
      new VRMLoaderPlugin(parser, {
        lookAtPlugin: new VRMLookAtSmootherLoaderPlugin(parser),
      })
  );

  return new Promise((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(new Error('Loading aborted'));
      return;
    }
    loader.load(
      url,
      (gltf) => {
        if (abortSignal.aborted) {
          return;
        }
        const vrm = gltf.userData.vrm;
        if (vrm) {
          resolve(vrm);
          cacheModel(url, vrm);
        } else {
          reject(new Error('VRM not found in GLTF userData'));
        }
      },
      (progressEvent) => {
        if (abortSignal.aborted) {
          reject(new Error('Loading aborted'));
          return;
        }
        if (progressEvent.lengthComputable) {
          const percentComplete =
            (progressEvent.loaded / progressEvent.total) * 100;
          onProgress?.(percentComplete);
        }
      },
      (error) => {
        if (!abortSignal.aborted) {
          console.error('Error loading model:', error);
          reject(error);
        }
      }
    );
  });
};

type VrmComponentProps = {
  visible?: boolean;
  defaultXYZ?: React.MutableRefObject<THREE.Vector3 | null>;
  posOffset?: THREE.Vector3;
  volume?: number;
};

export default function VrmComponent({
  visible = true,
  defaultXYZ: _defaultXYZ = null,
  posOffset = new THREE.Vector3(0, 0, 0),
  volume = 1,
}: VrmComponentProps) {
  const [vrm, setVrm] = useState<(VRM & AdditionalVrmProps) | null>(null);
  const [isIdleAnimationReady, setIsIdleAnimationReady] = useState(false);
  const modelRef = useRef<Model | null>(null);
  const abortController = useRef(new AbortController());
  const boneSmootherRef = useRef<BoneAnimationSmoother | null>(null);
  const smoothingConfig = useAnimationSmoothingStore((state) => state.config);

  const { camera } = useThree();

  const selectedVRM = useVRMStore((state) => state.selectedVRM);
  const setCurrentVRM = useVRMStore((state) => state.setCurrentVRM);
  const setVRMBlendShapeType = useVRMStore(
    (state) => state.setVRMBlendShapeType
  );
  const setHeadBone = useVRMStore((state) => state.setHeadBone);
  const setLoadingState = useVRMStore((state) => state.setLoadingState);
  const initializeAnimationController = useVRMStore(
    (state) => state.initializeAnimationController
  );
  const startAnimationSystem = useVRMStore(
    (state) => state.startAnimationSystem
  );
  const animationController = useVRMStore((state) => state.animationController);

  const { selectedAgent, allAgents } = useAgentStore();
  const currentAgent =
    allAgents.find((agent) => agent.id === selectedAgent) ?? null;

  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.setVolume(volume);
    }
  }, [volume]);

  // Sync bone animation smoothing configuration
  useEffect(() => {
    if (boneSmootherRef.current) {
      console.log(
        '[VrmComponent] Updating bone smoothing config:',
        smoothingConfig
      );
      boneSmootherRef.current.updateConfig(smoothingConfig);
    }
  }, [smoothingConfig]);

  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.unLoadVrm({ dispose: false });
      modelRef.current = null;
      setVrm(null);
    }
    if (!selectedVRM?.file?.url) {
      return;
    }

    const doLoad = async () => {
      try {
        console.log('[VrmComponent] Loading VRM:');
        setLoadingState({ isLoading: true, progress: 0 });
        const loadedVrm = await loadModel(
          selectedVRM.file.url,
          abortController.current.signal,
          (progress) => {
            setLoadingState({ isLoading: true, progress });
          }
        );

        if (!loadedVrm) return;

        console.log('[VrmComponent] VRM loaded:', loadedVrm);
        const model = new Model(camera);
        modelRef.current = model;
        model.vrm = loadedVrm;

        loadedVrm.scene.name = 'VRMRoot';
        // Ensure VRM meshes cast/receive shadows and configure materials for proper shadow rendering
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loadedVrm.scene.traverse((child: any) => {
          if (child && (child.isMesh || child.isSkinnedMesh)) {
            // Enable shadow casting and receiving for all VRM meshes
            child.castShadow = true;
            child.receiveShadow = true;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const materials: any[] = Array.isArray(child.material)
              ? child.material
              : [child.material];

            materials.forEach((mat) => {
              if (!mat) return;

              // Configure materials for proper shadow rendering
              if ('shadowSide' in mat) {
                // Use DoubleSide for shadow rendering to ensure shadows cast from both sides
                mat.shadowSide = THREE.DoubleSide;
              }

              // Ensure depthWrite is enabled for proper shadow depth testing
              if ('depthWrite' in mat) {
                mat.depthWrite = true;
              }

              // Handle transparency based on material type and usage
              if ('transparent' in mat) {
                // For hair and overlapping transparent textures, use alphaToCoverage for smooth edges
                const isHairMaterial =
                  mat.name?.toLowerCase().includes('hair') ||
                  mat.name?.toLowerCase().includes('hair') ||
                  child.name?.toLowerCase().includes('hair');

                if (isHairMaterial) {
                  mat.transparent = false;
                  if ('alphaTest' in mat) mat.alphaTest = 0.005; // Slightly higher for softer edges
                } else {
                  mat.transparent = true;
                  if ('alphaTest' in mat) mat.alphaTest = 0.005;
                }
              }

              mat.needsUpdate = true;
            });
          }
        });
        const headBoneNode = loadedVrm.humanoid.getNormalizedBoneNode(
          VRMHumanBoneName.Head
        );
        if (headBoneNode) {
          const eyePosition = new THREE.Vector3();
          headBoneNode.getWorldPosition(eyePosition);
          eyePosition.y += 0.1;
          (loadedVrm as VRM & AdditionalVrmProps).eyesPosition = eyePosition;
          setHeadBone(headBoneNode);
          loadedVrm.scene.traverse((o) => {
            o.frustumCulled = false;
          });
        }

        VRMUtils.rotateVRM0(loadedVrm);
        model.mixer = new THREE.AnimationMixer(loadedVrm.scene);

        // Initialize bone animation smoother
        const clock = new THREE.Clock();
        boneSmootherRef.current = new BoneAnimationSmoother(
          clock,
          smoothingConfig
        );
        boneSmootherRef.current.setVRM(loadedVrm);
        boneSmootherRef.current.setAnimationMixer(model.mixer);
        model.emoteController = new EmoteController(loadedVrm, camera);

        // Note: Emotion state management is now handled by the VRMEnhancedAnimationController
        // No need to connect emotionStateManager to the store anymore

        VRMUtils.removeUnnecessaryVertices(loadedVrm.scene);
        VRMUtils.removeUnnecessaryJoints(loadedVrm.scene);

        (loadedVrm as VRM & AdditionalVrmProps).model = model;
        setCurrentVRM(loadedVrm as VRM & AdditionalVrmProps);

        const matchType = getVRMBlendShapeType(loadedVrm);
        setVRMBlendShapeType(matchType as unknown as string);

        setVrm(loadedVrm as VRM & AdditionalVrmProps);

        // Initialize the new simple animation controller
        console.log(
          '[VrmComponent] 🎬 Initializing simple animation controller...'
        );
        await initializeAnimationController();

        // Start the animation system
        startAnimationSystem();

        console.log('[VrmComponent] ✅ Simple animation system started');
        setIsIdleAnimationReady(true);
      } catch (err) {
        if ((err as Error).message !== 'Loading aborted') {
          console.error('VRM loading error:', err);
        }
      } finally {
        console.log('[VrmComponent] VRM loading finished');
        // Set loading to false immediately after idle animation is ready
        setLoadingState({ isLoading: false, progress: 0 });
      }
    };

    abortController.current.abort();
    abortController.current = new AbortController();
    console.log('[VrmComponent] Starting VRM load for:');
    doLoad();

    return () => {
      abortController.current.abort();
    };
  }, [
    selectedVRM?.file?.url,
    camera,
    initializeAnimationController,
    setCurrentVRM,
    setVRMBlendShapeType,
    setHeadBone,
    setLoadingState,
    startAnimationSystem,
  ]);

  useEffect(() => {
    if (!vrm || !modelRef.current || !currentAgent) return;

    // OLD ANIMATION SYSTEM DISABLED - Using new simple animation controller instead
    // The new animation controller handles all animations automatically
    console.log(
      '[VrmComponent] 🎬 Old animation system disabled - using new simple animation controller'
    );

    // if (idleEntry?.animationId) {
    //   playIdleAnimationById(idleEntry.animationId);
    // } else {
    //   // Use Idle_2 as the default idle animation
    //   const defaultIdle = animationDictionary.find((a) => a.name.toLowerCase().includes('idle_2') && a.loop)
    //     || animationDictionary.find((a) => a.name.toLowerCase().includes('idle') && a.loop);
    //   if (defaultIdle) {
    //     playIdleAnimationById(defaultIdle.id);
    //   }
    // }
  }, [vrm, modelRef, currentAgent]);

  useFrame((_, delta) => {
    if (modelRef.current) {
      modelRef.current.update(delta);
    }

    // Update bone animation smoothing (check both Model and Controller transitions)
    const isAnyTransitioning =
      modelRef.current?.isTransitioning() ||
      animationController?.isTransitioning();

    if (boneSmootherRef.current && !isAnyTransitioning) {
      boneSmootherRef.current.shouldUpdateBones();
    }
  });

  const groupRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(0, -0.12, 0);
      if (posOffset) {
        groupRef.current.position.add(posOffset);
      }
    }
  }, [vrm, posOffset]);

  if (!vrm || !isIdleAnimationReady) return null;

  return (
    <>
      <group ref={groupRef} visible={visible}>
        <RotatableModel dragZone={[2, 5, 1]} debug={false}>
          <group scale={[1, 1, 1]}>
            <primitive object={vrm.scene} />
          </group>
        </RotatableModel>
      </group>
    </>
  );
}

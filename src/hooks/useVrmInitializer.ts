'use client';

import { VRM } from '@pixiv/three-vrm';
import { useEffect } from 'react';

import { isPreviewBridgeMode } from '@/lib/preview-bridge';
import useAgentStore from '@/store/useAgentStore';
import useVRMStore from '@/store/vrmStore';
import { BlendShapeCategory, VRM12Names } from '@/types/vrmTypes';

/** Returns VRM12 if enough known VRM 1.0 expressions are found, otherwise INVALID. */
export function getVRMBlendShapeType(theVRM: VRM): BlendShapeCategory {
  const exps = theVRM.expressionManager?.expressions || [];
  let matchCount = 0;

  exps.forEach((expr) => {
    VRM12Names.forEach((vname) => {
      if (
        vname.includes(expr.name.replace('VRMExpression_', '').toLowerCase())
      ) {
        matchCount++;
      }
    });
  });

  return matchCount >= 12
    ? BlendShapeCategory.VRM12
    : BlendShapeCategory.INVALID;
}

/**
 * Fetches all available VRM models from the API on application startup
 * and loads VRMA animation files, populating the vrmStore.
 */
export function useVrmInitializer() {
  const { fetchUpdateTrigger } = useAgentStore();
  const {
    setAllVrms,
    setUserAvailableVrms,
    loadVRMAAnimations,
    setIsLoadingVrms,
  } = useVRMStore();

  useEffect(() => {
    if (isPreviewBridgeMode()) return;

    async function fetchVrmsAndAnimations() {
      setIsLoadingVrms(true);
      try {
        const response = await fetch('/api/agent/ms-vrm', {
          method: 'GET',
          cache: 'no-cache',
        });

        if (!response.ok) {
          throw new Error(`fetch VRMs => status: ${response.status}`);
        }

        const { data } = await response.json();
        setAllVrms([...data]);

        const publicVrms = data
          .filter((x: { customVrm?: unknown }) => !x.customVrm)
          .sort((a: { id: number }, b: { id: number }) =>
            a.id > b.id ? 1 : -1
          );

        setUserAvailableVrms(publicVrms);
        await loadVRMAAnimations();
        setIsLoadingVrms(false);
      } catch (error) {
        console.error('[useVrmInitializer] Error fetching VRMs:', error);

        // Fallback to bundled local VRM if API is unavailable
        const localVrm = {
          id: 1,
          name: 'Lucy',
          file: {
            id: 1,
            url: '/vrm/Lucy.vrm',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          thumbnail: {
            id: 1,
            url: '/img/default-agent-logo.png',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          unlockedByDefault: true,
          description: 'Local fallback VRM - Lucy',
          tags: ['local', 'fallback'],
          vrmConfig: {
            offset: [0, 0, 0],
            rotation: [0, 0, 0],
            blendshapesUpperCase: false,
          },
          partners: [],
          userVRMTuning: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setAllVrms([localVrm]);
        setUserAvailableVrms([localVrm]);
        await loadVRMAAnimations();
        setIsLoadingVrms(false);
      }
    }

    void fetchVrmsAndAnimations();
  }, [
    fetchUpdateTrigger,
    loadVRMAAnimations,
    setAllVrms,
    setIsLoadingVrms,
    setUserAvailableVrms,
  ]);
}

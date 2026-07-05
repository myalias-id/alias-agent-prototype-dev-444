'use client';

import { useEffect } from 'react';

import {
  addPreviewBridgeListener,
  isPreviewBridgeMode,
  postPreviewBridgeMessage,
} from '@/lib/preview-bridge';
import useBackgroundStore from '@/store/backgroundStore';
import useAgentStore from '@/store/useAgentStore';
import useVRMStore from '@/store/vrmStore';
import { IAgent } from '@/types/agent';

type PreviewConfigMessage = {
  agent?: IAgent;
  sessionId?: string;
  user?: { id?: string };
};

export function usePreviewBridgeInitializer() {
  useEffect(() => {
    if (!isPreviewBridgeMode()) return;

    const removeConfigListener = addPreviewBridgeListener<PreviewConfigMessage>(
      'alias-preview:config',
      (message) => {
        const agent = message.agent;
        if (!agent?.id) return;

        useAgentStore.getState().hydratePreviewAgent(agent);

        const backgroundStore = useBackgroundStore.getState();
        if (agent.bg) {
          backgroundStore.setAllBackgrounds([agent.bg]);
          backgroundStore.setUserAvailableBackgrounds([agent.bg]);
          backgroundStore.setCurrentBackground(agent.bg);
        }

        const vrmStore = useVRMStore.getState();
        if (agent.vrm) {
          vrmStore.setAllVrms([agent.vrm]);
          vrmStore.setUserAvailableVrms([agent.vrm]);
          vrmStore.setSelectedVRM(agent.vrm);
        }
        if (agent.defaults?.vrmDisplay) {
          vrmStore.setVrmDisplayMode(agent.defaults.vrmDisplay);
        }
        vrmStore.setIsLoadingVrms(false);
        void vrmStore.loadVRMAAnimations();
      }
    );

    postPreviewBridgeMessage('alias-preview:ready');

    return removeConfigListener;
  }, []);
}

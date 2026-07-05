'use client';

import { useEffect } from 'react';

import { isPreviewBridgeMode } from '@/lib/preview-bridge';
import useBackgroundStore from '@/store/backgroundStore';
import useAgentStore from '@/store/useAgentStore';
import useVRMStore from '@/store/vrmStore';

const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID;

/**
 * Orchestrates initial agent loading on application startup.
 * Fetches the primary agent, then sets the appropriate VRM and background
 * based on the agent's configuration.
 */
export function useAgentInitializer() {
  const { agent, fetchAgentById, fetchUpdateTrigger, setIsLoading } =
    useAgentStore();
  const { setCurrentBackground, allBackgrounds } = useBackgroundStore();
  const { userAvailableVrms, allVrms, setSelectedVRM, isLoadingVrms } =
    useVRMStore();

  useEffect(() => {
    if (isPreviewBridgeMode()) return;

    const loadAgent = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const agentIdFromQuery = urlParams.get('agentId');
      const agentIdToUse = agentIdFromQuery || AGENT_ID;

      if (!agentIdToUse) {
        console.warn(
          '[useAgentInitializer] No agent ID found, skipping agent load'
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      await fetchAgentById(Number(agentIdToUse));
    };

    void loadAgent();
  }, [fetchAgentById, fetchUpdateTrigger, setIsLoading]);

  useEffect(() => {
    if (!agent) return;
    if (isLoadingVrms) return;

    if (agent.vrmId) {
      const pickVRM = allVrms.find((v) => v.id === agent.vrmId);
      setSelectedVRM(pickVRM ?? userAvailableVrms?.[0] ?? null);
    } else {
      setSelectedVRM(userAvailableVrms?.[0] ?? null);
    }

    if (allBackgrounds.length > 0 && agent.bgId) {
      const backgroundToSet = allBackgrounds.find((bg) => bg.id === agent.bgId);
      setCurrentBackground(backgroundToSet ?? null);
    }

    setIsLoading(false);
  }, [
    agent,
    allBackgrounds,
    allVrms,
    isLoadingVrms,
    setCurrentBackground,
    setIsLoading,
    setSelectedVRM,
    userAvailableVrms,
  ]);
}

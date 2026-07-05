'use client';
import React, { useEffect } from 'react';

import { useAgentInitializer } from '@/hooks/useAgentInitializer';
import { useBackgroundInitializer } from '@/hooks/useBackgroundInitializer';
import { usePreviewBridgeInitializer } from '@/hooks/usePreviewBridgeInitializer';
import { useVrmInitializer } from '@/hooks/useVrmInitializer';
import { closeAudioContext } from '@/lib/audioContext';

export default function ContextWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  usePreviewBridgeInitializer();
  useAgentInitializer();
  useBackgroundInitializer();
  useVrmInitializer();

  useEffect(() => {
    return () => {
      void closeAudioContext();
    };
  }, []);

  return <>{children}</>;
}

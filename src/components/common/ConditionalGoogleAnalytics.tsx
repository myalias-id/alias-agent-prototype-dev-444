'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

import {
  checkAndSaveInternalTeamFlag,
  isInternalTeamMember,
} from '@/lib/analytics';

interface ConditionalGoogleAnalyticsProps {
  gaId: string;
}

export default function ConditionalGoogleAnalytics({
  gaId,
}: ConditionalGoogleAnalyticsProps) {
  const [shouldLoadGA, setShouldLoadGA] = useState<boolean>(true);

  useEffect(() => {
    // Check URL query parameters and save flag if present
    checkAndSaveInternalTeamFlag();

    // Check if user is internal team member
    const isInternal = isInternalTeamMember();
    setShouldLoadGA(!isInternal);
  }, []);

  // Don't render GoogleAnalytics if user is internal team member
  if (!shouldLoadGA || !gaId) {
    return null;
  }

  return <GoogleAnalytics gaId={gaId} />;
}

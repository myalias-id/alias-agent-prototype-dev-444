'use client';

import React from 'react';

import Loading from '@/app/loading';
import useAgentStore from '@/store/useAgentStore';

interface LoadingWrapperProps {
  children: React.ReactNode;
}

const LoadingWrapper = ({ children }: LoadingWrapperProps) => {
  const agentLoading = useAgentStore((state) => state.isLoading);

  if (agentLoading) {
    return <Loading />;
  }

  return <>{children}</>;
};

export default LoadingWrapper;

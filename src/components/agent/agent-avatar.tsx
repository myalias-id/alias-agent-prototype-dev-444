'use client';

import React from 'react';
import { Vector3 } from 'three';

import { MainCanvas } from '@/components/canvas';
import VrmComponent from '@/components/vrm/VrmComponent';

export default function AgentAvatar() {
  return (
    <div className="relative w-full h-full text-white overflow-hidden">
      <MainCanvas xOffset={0} zOffset={0}>
        <VrmComponent posOffset={new Vector3(0, 0, 0)} />
      </MainCanvas>
    </div>
  );
}

'use client';

import React from 'react';

interface VideoBackgroundProps {
  children: React.ReactNode;
  videoSrc?: string;
}

export const VideoBackground = ({
  children,
  videoSrc = '/wave-loop.mp4',
}: VideoBackgroundProps) => {
  return (
    <div className="relative w-full h-full">
      {/* Fixed Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0"
        style={{ pointerEvents: 'none' }}>
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};

export default VideoBackground;

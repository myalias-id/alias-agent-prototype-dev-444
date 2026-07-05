'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';
import { getYouTubeEmbedUrl } from '@/lib/utils/url-detection';

interface VideoEmbedProps {
  src: string;
  isUser?: boolean;
}

export const VideoEmbed = memo(({ src, isUser }: VideoEmbedProps) => {
  const embedSrc = getYouTubeEmbedUrl(src);

  if (!embedSrc) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {src}
      </a>
    );
  }

  return (
    <div className={cn('rounded-md overflow-hidden', isUser ? 'my-0' : 'my-2')}>
      <iframe
        src={embedSrc}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full aspect-video"
        title="Embedded video"
      />
    </div>
  );
});
VideoEmbed.displayName = 'VideoEmbed';

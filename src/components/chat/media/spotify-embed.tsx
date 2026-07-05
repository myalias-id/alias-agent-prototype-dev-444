'use client';

import { memo } from 'react';

import { getSpotifyEmbedUrl } from '@/lib/utils/url-detection';

interface SpotifyEmbedProps {
  src: string;
}

export const SpotifyEmbed = memo(({ src }: SpotifyEmbedProps) => {
  const embedSrc = getSpotifyEmbedUrl(src);

  if (!embedSrc) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {src}
      </a>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden my-2 w-full">
      <iframe
        src={embedSrc}
        width="100%"
        height="152"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        title="Spotify embed"
        style={{ borderRadius: '12px' }}
      />
    </div>
  );
});
SpotifyEmbed.displayName = 'SpotifyEmbed';

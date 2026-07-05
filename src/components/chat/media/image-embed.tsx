'use client';

import React, { memo, useCallback, useState } from 'react';

import { cn } from '@/lib/utils';

interface ImageEmbedProps {
  src: string;
  isUser?: boolean;
  onOpenLightbox?: (src: string) => void;
}

export const ImageEmbed = memo(
  ({ src, isUser, onOpenLightbox }: ImageEmbedProps) => {
    const [imageError, setImageError] = useState(false);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenLightbox?.(src);
      },
      [src, onOpenLightbox]
    );

    const handleError = useCallback(() => {
      setImageError(true);
    }, []);

    if (imageError) {
      return (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-foreground italic">
          {src}
        </a>
      );
    }

    return (
      <div
        className={cn(
          'rounded-md overflow-hidden max-w-full cursor-pointer transition-opacity hover:opacity-90',
          isUser ? 'my-0' : 'my-2'
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        aria-label="Click to open image in lightbox">
        <img
          src={src}
          alt="Embedded image"
          className="max-w-full h-auto rounded-[10px] pointer-events-none"
          loading="lazy"
          onError={handleError}
        />
      </div>
    );
  }
);
ImageEmbed.displayName = 'ImageEmbed';

interface ProbeableImageEmbedProps {
  src: string;
  isUser?: boolean;
  fallback: React.ReactNode;
  onOpenLightbox?: (src: string) => void;
}

/** Renders fallback immediately; upgrades to ImageEmbed if the URL resolves as an image. */
export const ProbeableImageEmbed = memo(
  ({ src, isUser, fallback, onOpenLightbox }: ProbeableImageEmbedProps) => {
    const [isImage, setIsImage] = useState(false);

    React.useEffect(() => {
      const img = new Image();
      img.onload = () => setIsImage(true);
      img.src = src;
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }, [src]);

    if (isImage) {
      return (
        <ImageEmbed src={src} isUser={isUser} onOpenLightbox={onOpenLightbox} />
      );
    }
    return <>{fallback}</>;
  }
);
ProbeableImageEmbed.displayName = 'ProbeableImageEmbed';

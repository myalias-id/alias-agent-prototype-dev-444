'use client';

import { memo, useCallback, useEffect, useState } from 'react';

import { CancelSVG } from '@/components/svg';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getYouTubeEmbedUrl } from '@/lib/utils/url-detection';

export type LightboxType = 'image' | 'video';

type LightboxState = {
  isOpen: boolean;
  src: string | null;
  type: LightboxType | null;
};

type LightboxSubscriber = (state: LightboxState) => void;

class LightboxManager {
  private state: LightboxState = { isOpen: false, src: null, type: null };
  private subscribers = new Set<LightboxSubscriber>();

  subscribe(callback: LightboxSubscriber) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    this.subscribers.forEach((cb) => cb(this.state));
  }

  open(src: string, type: LightboxType) {
    this.state = { isOpen: true, src, type };
    this.notify();
  }

  close() {
    this.state = { isOpen: false, src: null, type: null };
    this.notify();
  }

  getState() {
    return this.state;
  }
}

export const lightboxManager = new LightboxManager();

/** Returns a stable callback that opens the lightbox for an image. */
export function useLightbox() {
  return useCallback((src: string) => {
    lightboxManager.open(src, 'image');
  }, []);
}

interface GlobalLightboxProps {
  isDark: boolean;
}

/** Renders the global lightbox overlay. Mount once at the top of the chat UI. */
export const GlobalLightbox = memo(({ isDark }: GlobalLightboxProps) => {
  const [lightboxState, setLightboxState] = useState<LightboxState>(
    lightboxManager.getState()
  );

  useEffect(() => lightboxManager.subscribe(setLightboxState), []);

  const closeLightbox = useCallback(() => lightboxManager.close(), []);

  useEffect(() => {
    if (!lightboxState.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [lightboxState.isOpen, closeLightbox]);

  useEffect(
    () => () => {
      document.body.style.overflow = 'unset';
    },
    []
  );

  const closeButton = (
    <Button
      variant="default"
      size="icon"
      className={cn(
        'bg-white/20 hover:bg-white/40 border-none transition-all duration-300 absolute top-4 right-4',
        isDark && 'bg-black/60 hover:bg-black/80'
      )}
      onClick={closeLightbox}
      aria-label="Close lightbox">
      <CancelSVG
        height={20}
        width={20}
        className={cn('text-black hover:text-alias', isDark && 'text-white')}
      />
    </Button>
  );

  return (
    <Dialog open={lightboxState.isOpen} onOpenChange={closeLightbox}>
      <DialogContent
        overlayClassName="backdrop-blur-sm"
        className={cn(
          'sm:w-[90vw] w-full h-auto p-0 [&>button]:hidden shadow-none border-[0.4px] border-white overflow-hidden',
          isDark && 'border-white/10'
        )}
        onClick={closeLightbox}>
        {lightboxState.src && lightboxState.type === 'image' && (
          <div
            className="relative w-full h-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxState.src}
              alt="Lightbox image"
              className="w-full h-auto object-contain rounded-lg"
            />
            {closeButton}
          </div>
        )}
        {lightboxState.src && lightboxState.type === 'video' && (
          <div
            className="relative w-full h-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-4xl aspect-video">
              <iframe
                src={getYouTubeEmbedUrl(lightboxState.src) ?? lightboxState.src}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
                title="Lightbox video"
              />
            </div>
            {closeButton}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
GlobalLightbox.displayName = 'GlobalLightbox';

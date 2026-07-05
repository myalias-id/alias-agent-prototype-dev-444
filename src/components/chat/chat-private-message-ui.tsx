'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@/context/theme-context';
import { cn, parseMessageContent } from '@/lib/utils';
import { extractChatText } from '@/lib/utils/chat-utils';
import {
  GOOGLE_MAPS_URL_REGEX,
  IMAGE_URL_REGEX,
  KNOWN_NON_IMAGE_REGEX,
  VIDEO_URL_REGEX,
} from '@/lib/utils/url-detection';
import { Message } from '@/store/useSocketChatStore';

import { GlobalLightbox, lightboxManager } from './lightbox';
import { MarkdownContent } from './markdown-content';

const normalizeUrlToken = (token: string): string => {
  const trimmed = token
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/^["']|["']$/g, '');
  const markdownMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  const url = (markdownMatch?.[2] ?? trimmed).trim();
  return url.startsWith('www.') ? `https://${url}` : url;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isCarouselImageUrl = (value: string): boolean =>
  isHttpUrl(value) &&
  (IMAGE_URL_REGEX.test(value) ||
    (!VIDEO_URL_REGEX.test(value) &&
      !GOOGLE_MAPS_URL_REGEX.test(value) &&
      !KNOWN_NON_IMAGE_REGEX.test(value)));

const IMAGE_URL_IN_TEXT_REGEX =
  /(?:https?:\/\/|www\.)[^\s<>"')\]]*?\.(?:jpg|jpeg|png|gif|bmp|webp|svg|avif|ico)(?:\?[^\s<>"')\],]*)?/gi;

type RichMessageSegment =
  | {
      content: string;
      type: 'text';
    }
  | {
      imageUrls: string[];
      type: 'carousel';
    };

interface ImageUrlMatch {
  end: number;
  start: number;
  url: string;
}

interface ImageUrlRun {
  end: number;
  imageUrls: string[];
  start: number;
}

const cleanCarouselText = (text: string): string =>
  text
    .replace(/\\n/g, '\n')
    .replace(/[ \t]*,[ \t]*(?=\n|$)/g, '')
    .replace(/(^|\n)[ \t]*,[ \t]*/g, '$1')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const addTextSegment = (segments: RichMessageSegment[], content: string) => {
  const cleanText = cleanCarouselText(content);
  if (!cleanText) return;
  segments.push({ content: cleanText, type: 'text' });
};

const isImageRunSeparator = (content: string): boolean =>
  /^[\s,]*$/.test(content);

const getRichImageSegments = (content: string): RichMessageSegment[] => {
  const normalizedContent = content.replace(/\\n/g, '\n');
  const imageMatches: ImageUrlMatch[] = Array.from(
    normalizedContent.matchAll(IMAGE_URL_IN_TEXT_REGEX)
  )
    .map((match) => ({
      end: (match.index ?? 0) + match[0].length,
      start: match.index ?? 0,
      url: normalizeUrlToken(match[0]),
    }))
    .filter((match) => isCarouselImageUrl(match.url));

  if (imageMatches.length < 2) {
    return [];
  }

  const imageRuns = imageMatches.reduce<ImageUrlRun[]>((runs, match) => {
    const currentRun = runs[runs.length - 1];

    if (
      currentRun &&
      isImageRunSeparator(normalizedContent.slice(currentRun.end, match.start))
    ) {
      currentRun.imageUrls.push(match.url);
      currentRun.end = match.end;
      return runs;
    }

    runs.push({
      end: match.end,
      imageUrls: [match.url],
      start: match.start,
    });
    return runs;
  }, []);

  const carouselRuns = imageRuns.filter((run) => run.imageUrls.length > 1);
  if (carouselRuns.length === 0) {
    return [];
  }

  const segments: RichMessageSegment[] = [];
  let cursor = 0;

  carouselRuns.forEach((run) => {
    addTextSegment(segments, normalizedContent.slice(cursor, run.start));
    segments.push({ imageUrls: run.imageUrls, type: 'carousel' });
    cursor = run.end;
  });

  addTextSegment(segments, normalizedContent.slice(cursor));

  return segments;
};

interface ImageCarouselProps {
  imageUrls: string[];
  isDark: boolean;
  onOpenLightbox: (src: string) => void;
}

const ChatImageCarousel = memo(
  ({ imageUrls, isDark, onOpenLightbox }: ImageCarouselProps) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({
      canScrollNext: false,
      canScrollPrev: false,
    });

    const updateScrollState = useCallback(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const canScrollPrev = scroller.scrollLeft > 2;
      const canScrollNext =
        scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;

      setScrollState((current) =>
        current.canScrollPrev === canScrollPrev &&
        current.canScrollNext === canScrollNext
          ? current
          : { canScrollNext, canScrollPrev }
      );
    }, []);

    useEffect(() => {
      updateScrollState();

      const scroller = scrollerRef.current;
      if (!scroller || typeof ResizeObserver === 'undefined') return;

      const observer = new ResizeObserver(updateScrollState);
      observer.observe(scroller);

      return () => observer.disconnect();
    }, [imageUrls.length, updateScrollState]);

    const scrollBySlide = useCallback((direction: -1 | 1) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const firstSlide = scroller.querySelector<HTMLElement>(
        '[data-carousel-slide]'
      );
      const gap = parseFloat(
        window.getComputedStyle(scroller).columnGap || '0'
      );
      const scrollAmount =
        firstSlide?.offsetWidth ?? Math.round(scroller.clientWidth * 0.8);

      scroller.scrollBy({
        left: direction * (scrollAmount + gap),
        behavior: 'smooth',
      });
    }, []);

    return (
      <div
        className={cn(
          'relative w-full min-w-0 overflow-hidden rounded-md',
          isDark ? 'text-white' : 'text-foreground'
        )}>
        <button
          type="button"
          onClick={() => scrollBySlide(-1)}
          disabled={!scrollState.canScrollPrev}
          className={cn(
            'absolute left-1.5 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full border transition-colors duration-200',
            isDark
              ? 'border-white/15 bg-black/40 text-white hover:bg-white/15'
              : 'border-black/10 bg-white/80 text-foreground hover:bg-white',
            !scrollState.canScrollPrev && 'pointer-events-none opacity-0'
          )}
          aria-label="Previous image">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollBySlide(1)}
          disabled={!scrollState.canScrollNext}
          className={cn(
            'absolute right-1.5 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full border transition-colors duration-200',
            isDark
              ? 'border-white/15 bg-black/40 text-white hover:bg-white/15'
              : 'border-black/10 bg-white/80 text-foreground hover:bg-white',
            !scrollState.canScrollNext && 'pointer-events-none opacity-0'
          )}
          aria-label="Next image">
          <ChevronRight className="h-4 w-4" />
        </button>

        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1">
          {imageUrls.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              data-carousel-slide
              onClick={() => onOpenLightbox(src)}
              className={cn(
                'group relative aspect-[4/5] min-w-[150px] basis-[78%] shrink-0 snap-start overflow-hidden rounded-lg border transition-transform duration-300 hover:scale-[0.99] sm:basis-[46%] lg:basis-[31%]',
                isDark
                  ? 'border-white/10 bg-white/5'
                  : 'border-black/5 bg-black/5'
              )}
              aria-label={`Open image ${index + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Carousel image ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }
);
ChatImageCarousel.displayName = 'ChatImageCarousel';

const ChatPrivateMessageUIContent = memo(({ msg }: { msg: Message }) => {
  const isUser = msg.isUser;
  const rawContent = !isUser ? extractChatText(msg.content) : msg.content;
  const parsedContent = parseMessageContent(rawContent);
  const { isDark } = useTheme();
  const richImageSegments = useMemo(
    () => getRichImageSegments(rawContent),
    [rawContent]
  );
  const hasImageCarousel = richImageSegments.some(
    (segment) => segment.type === 'carousel'
  );

  const openLightbox = useCallback((src: string) => {
    lightboxManager.open(src, 'image');
  }, []);

  const renderRichImageSegment = useCallback(
    (segment: RichMessageSegment, index: number) => {
      if (segment.type === 'carousel') {
        return (
          <ChatImageCarousel
            key={`carousel-${index}`}
            imageUrls={segment.imageUrls}
            isDark={isDark}
            onOpenLightbox={openLightbox}
          />
        );
      }

      return (
        <div
          key={`text-${index}`}
          data-carousel-text
          className="w-full min-w-0 break-words">
          <MarkdownContent
            content={parseMessageContent(segment.content)}
            isUser={isUser}
            onOpenLightbox={openLightbox}
          />
        </div>
      );
    },
    [isDark, isUser, openLightbox]
  );

  // Determine if the user message is purely a media URL (no text bubble wrapper needed)
  const contentToCheck = parsedContent
    .trim()
    .replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1');
  const isOnlyImageOrVideo =
    isUser &&
    (hasImageCarousel ||
      IMAGE_URL_REGEX.test(contentToCheck) ||
      VIDEO_URL_REGEX.test(contentToCheck) ||
      (/https?:\/\//.test(contentToCheck) &&
        !VIDEO_URL_REGEX.test(contentToCheck) &&
        !IMAGE_URL_REGEX.test(contentToCheck) &&
        !KNOWN_NON_IMAGE_REGEX.test(contentToCheck)));

  const isGoogleMapsUrl = isUser && GOOGLE_MAPS_URL_REGEX.test(contentToCheck);

  return (
    <div
      key={msg.id}
      className={cn(
        'my-2 flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}>
      <div
        className={cn(
          'flex items-start gap-x-2.5',
          isUser && isGoogleMapsUrl
            ? 'justify-end  w-[90%]'
            : isUser && hasImageCarousel
              ? 'justify-end w-full'
              : isUser
                ? 'justify-end'
                : 'justify-start w-full'
        )}>
        {isUser && !isGoogleMapsUrl && !hasImageCarousel && (
          <div className="mr-auto rounded-md w-[48px]" />
        )}
        <div
          className={cn(
            'flex flex-col gap-y-2.5 w-full',
            isUser && 'items-end'
          )}>
          <div
            className={cn(
              'rounded-lg',
              isGoogleMapsUrl
                ? 'w-full text-foreground'
                : isUser
                  ? hasImageCarousel
                    ? isDark
                      ? 'w-full max-w-[520px] bg-white/10 px-4 py-4 text-white backdrop-blur-[120px]'
                      : 'w-full max-w-[520px] [background:linear-gradient(to_right,color-mix(in_srgb,var(--color-alias)_50%,transparent),color-mix(in_srgb,var(--color-alias)_50%,white))] px-4 py-4 text-foreground backdrop-blur-[120px]'
                    : isOnlyImageOrVideo
                      ? 'w-fit max-w-2/3 text-foreground'
                      : isDark
                        ? 'w-fit max-w-2/3 bg-white/10 text-white py-4 px-4 backdrop-blur-[120px]'
                        : 'w-fit max-w-2/3 [background:linear-gradient(to_right,color-mix(in_srgb,var(--color-alias)_50%,transparent),color-mix(in_srgb,var(--color-alias)_50%,white))] backdrop-blur-[120px] text-foreground py-4 px-4'
                  : hasImageCarousel
                    ? isDark
                      ? 'w-full border border-white/10 bg-white/10 p-3 text-white shadow-sm backdrop-blur-xl'
                      : 'w-full border border-black/5 bg-white/90 p-3 text-foreground shadow-sm backdrop-blur-xl'
                    : 'text-foreground w-full',
              isDark && 'text-white'
            )}>
            {hasImageCarousel ? (
              <div className="flex w-full min-w-0 flex-col gap-3">
                {richImageSegments.map(renderRichImageSegment)}
              </div>
            ) : (
              <MarkdownContent
                content={parsedContent}
                isUser={isUser}
                onOpenLightbox={openLightbox}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
ChatPrivateMessageUIContent.displayName = 'ChatPrivateMessageUIContent';

export const ChatPrivateMessageUI = memo(({ msg }: { msg: Message }) => {
  const { isDark } = useTheme();
  return (
    <>
      <ChatPrivateMessageUIContent msg={msg} />
      <GlobalLightbox isDark={isDark} />
    </>
  );
});
ChatPrivateMessageUI.displayName = 'ChatPrivateMessageUI';

'use client';

import React, { memo, useCallback } from 'react';
import type { Options as ReactMarkdownOptions } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { RedirectSVG } from '@/components/svg';
import { sendGAEvent } from '@/lib/analytics';
import {
  extractGoogleMapsPlaceName,
  GOOGLE_MAPS_URL_REGEX,
  IMAGE_URL_REGEX,
  KNOWN_NON_IMAGE_REGEX,
  SPOTIFY_URL_REGEX,
  VIDEO_URL_REGEX,
} from '@/lib/utils/url-detection';
import useSocketChatStore from '@/store/useSocketChatStore';

import { GooglePlacesCard } from './media/google-places-card';
import { ImageEmbed, ProbeableImageEmbed } from './media/image-embed';
import { SpotifyEmbed } from './media/spotify-embed';
import { VideoEmbed } from './media/video-embed';

const markdownHtmlSanitizeSchema: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'article',
    'aside',
    'figcaption',
    'figure',
    'mark',
    'small',
    'u',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'data*'],
  },
  strip: [...(defaultSchema.strip ?? []), 'style'],
};

const markdownRehypePlugins: NonNullable<
  ReactMarkdownOptions['rehypePlugins']
> = [rehypeRaw, [rehypeSanitize, markdownHtmlSanitizeSchema]];

interface BubbleLinkProps {
  href: string;
  children?: React.ReactNode;
}

const BubbleLink = memo(({ href, children: _children }: BubbleLinkProps) => {
  const { userId } = useSocketChatStore();

  let cleanHref = href.replace(/[.,;:!?]$/, '');
  cleanHref = cleanHref.replace(/^[[]"]+/, '').replace(/[[]"]+$/, '');
  if (!cleanHref.startsWith('http://') && !cleanHref.startsWith('https://')) {
    cleanHref = 'https://' + cleanHref;
  }

  const handleClick = () => {
    sendGAEvent('event', 'ticket_click', {
      user_id: userId,
      time_in_utc: new Date().toISOString(),
    });
    window.open(cleanHref, '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={cleanHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      className="inline-flex items-center align-top gap-1 px-[6px] py-[2px] mx-1 bg-backgroundSecondary border border-gray-600 text-white rounded-md hover:bg-foreground hover:text-primary active:bg-foreground active:text-primary transition-colors duration-200 max-w-[200px] max-h-5 truncate no-underline"
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        cursor: 'pointer',
        position: 'relative',
        zIndex: 1,
        display: 'inline-flex',
      }}>
      <RedirectSVG height={14} width={14} className="text-inherit" />
    </a>
  );
});
BubbleLink.displayName = 'BubbleLink';

interface MarkdownContentProps {
  content: string;
  isUser: boolean;
  onOpenLightbox: (src: string) => void;
}

export const MarkdownContent = memo(
  ({ content, isUser, onOpenLightbox }: MarkdownContentProps) => {
    const buildComponents = useCallback(
      () => ({
        a: ({
          href,
          children,
          ..._props
        }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
          children?: React.ReactNode;
        }) => {
          const linkText =
            typeof children === 'string'
              ? children
              : React.Children.count(children) === 1
                ? String(children)
                : '';

          if (
            SPOTIFY_URL_REGEX.test(linkText) ||
            (href && SPOTIFY_URL_REGEX.test(href))
          ) {
            return <SpotifyEmbed src={linkText || href!} />;
          }
          if (
            VIDEO_URL_REGEX.test(linkText) ||
            (href && VIDEO_URL_REGEX.test(href))
          ) {
            return <VideoEmbed src={linkText || href!} isUser={isUser} />;
          }
          if (
            IMAGE_URL_REGEX.test(linkText) ||
            (href && IMAGE_URL_REGEX.test(href))
          ) {
            return (
              <ImageEmbed
                src={linkText || href!}
                isUser={isUser}
                onOpenLightbox={onOpenLightbox}
              />
            );
          }
          if (href?.toLowerCase().startsWith('mailto:')) {
            const email = href.replace(/^mailto:/i, '');
            return (
              <a href={href} className="text-foreground underline">
                {email}
              </a>
            );
          }
          // Google Maps / Places URL → rich place card
          const mapsCandidate =
            linkText && GOOGLE_MAPS_URL_REGEX.test(linkText)
              ? linkText
              : href && GOOGLE_MAPS_URL_REGEX.test(href)
                ? href
                : null;
          if (mapsCandidate) {
            const placeName = extractGoogleMapsPlaceName(mapsCandidate);
            if (placeName) {
              return (
                <GooglePlacesCard query={placeName} mapsUrl={mapsCandidate} />
              );
            }
          }
          if (href && !KNOWN_NON_IMAGE_REGEX.test(href)) {
            return (
              <ProbeableImageEmbed
                src={href}
                isUser={isUser}
                onOpenLightbox={onOpenLightbox}
                fallback={<BubbleLink href={href}>{children}</BubbleLink>}
              />
            );
          }
          return <BubbleLink href={href ?? ''}>{children}</BubbleLink>;
        },

        p: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLParagraphElement> & {
          node?: unknown;
          children?: React.ReactNode;
        }) => {
          const textContent =
            typeof children === 'string'
              ? children
              : React.Children.count(children) === 1 &&
                  typeof children === 'object'
                ? (children as React.ReactElement)?.props?.children
                : null;

          if (textContent && SPOTIFY_URL_REGEX.test(textContent)) {
            return <SpotifyEmbed src={textContent} />;
          }
          if (textContent && VIDEO_URL_REGEX.test(textContent)) {
            return <VideoEmbed src={textContent} isUser={isUser} />;
          }
          if (textContent && IMAGE_URL_REGEX.test(textContent)) {
            return (
              <ImageEmbed
                src={textContent}
                isUser={isUser}
                onOpenLightbox={onOpenLightbox}
              />
            );
          }
          if (textContent && GOOGLE_MAPS_URL_REGEX.test(textContent)) {
            const placeName = extractGoogleMapsPlaceName(textContent);
            if (placeName) {
              return (
                <GooglePlacesCard query={placeName} mapsUrl={textContent} />
              );
            }
          }
          if (
            textContent &&
            /^https?:\/\//.test(textContent) &&
            !KNOWN_NON_IMAGE_REGEX.test(textContent) &&
            !VIDEO_URL_REGEX.test(textContent) &&
            !SPOTIFY_URL_REGEX.test(textContent)
          ) {
            return (
              <ProbeableImageEmbed
                src={textContent}
                isUser={isUser}
                onOpenLightbox={onOpenLightbox}
                fallback={<p {...props}>{children}</p>}
              />
            );
          }
          return <p {...props}>{children}</p>;
        },

        code: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }) => (
          <code className="bg-background rounded px-1 py-0.5" {...props}>
            {children}
          </code>
        ),

        ul: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLUListElement> & {
          children?: React.ReactNode;
        }) => (
          <ul className="list-disc pl-5 my-2 space-y-2" {...props}>
            {children}
          </ul>
        ),

        ol: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLOListElement> & {
          children?: React.ReactNode;
        }) => (
          <ol className="list-decimal pl-5 my-2 space-y-2" {...props}>
            {children}
          </ol>
        ),

        li: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLLIElement> & {
          children?: React.ReactNode;
        }) => <li {...props}>{children}</li>,
      }),
      [isUser, onOpenLightbox]
    );

    return (
      <ReactMarkdown
        components={buildComponents()}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={markdownRehypePlugins}>
        {content}
      </ReactMarkdown>
    );
  }
);
MarkdownContent.displayName = 'MarkdownContent';

'use client';

import { memo, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import type { PlaceResult } from '@/types/places';

interface GooglePlacesCardProps {
  /** The place name to search for (extracted from the Maps URL). */
  query: string;
  /** The original Google Maps URL — used as the fallback "Open in Maps" link. */
  mapsUrl: string;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span
      className="flex items-center gap-0.5 text-warning"
      aria-label={`${rating} stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <svg
          key={`f${i}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3 h-3">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {half && (
        <svg viewBox="0 0 20 20" className="w-3 h-3">
          <defs>
            <linearGradient id="half-grad">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            fill="url(#half-grad)"
            stroke="currentColor"
            strokeWidth="0.5"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <svg
          key={`e${i}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="w-3 h-3">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-[10px] bg-backgroundSecondary overflow-hidden flex w-full max-w-full my-2 animate-pulse">
      <div className="w-2/5 max-h-[150px] flex-shrink-0 bg-muted/30" />
      <div className="flex flex-col gap-1 p-3 flex-1 min-w-0">
        {/* name */}
        <div className="h-[18px] rounded bg-muted/30 w-3/4" />
        {/* address */}
        <div className="h-4 rounded bg-muted/20 w-full" />
        {/* rating row */}
        <div className="h-4 rounded bg-muted/20 w-2/5 mt-0.5" />
        {/* open/closed */}
        <div className="h-4 rounded bg-muted/20 w-1/4" />
        {/* maps link */}
        <div className="h-4 rounded bg-muted/20 w-2/5 mt-1" />
      </div>
    </div>
  );
}

export const GooglePlacesCard = memo(
  ({ query, mapsUrl }: GooglePlacesCardProps) => {
    const [place, setPlace] = useState<PlaceResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;

      fetch(`/api/places?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((json: { status: string; data?: PlaceResult }) => {
          if (!cancelled && json.status === 'success' && json.data) {
            setPlace(json.data);
          }
        })
        .catch(() => {
          /* silently fall through to null */
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [query]);

    if (loading) return <CardSkeleton />;

    // Fallback: plain link if place not found or API not configured
    if (!place) {
      return (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#2467B1] underline text-sm">
          {query}
        </a>
      );
    }

    const photoUrl = place.photoRef
      ? `/api/places/photo?ref=${encodeURIComponent(place.photoRef)}&maxwidth=800`
      : null;

    return (
      <div className="rounded-[10px] bg-white dark:bg-backgroundSecondary overflow-hidden flex w-full max-w-full my-2">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={place.name}
            className="w-2/5 max-h-[150px] flex-shrink-0 object-cover"
            loading="lazy"
          />
        )}
        <div
          className={cn(
            'flex flex-col gap-1 p-3 flex-1 min-w-0',
            !photoUrl && 'pl-3'
          )}>
          <p className="font-semibold text-sm text-foreground truncate leading-tight">
            {place.name}
          </p>
          <p className="text-xs text-mutedForeground truncate">
            {place.address}
          </p>

          {place.rating !== undefined && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-medium text-foreground">
                {place.rating.toFixed(1)}
              </span>
              <StarRating rating={place.rating} />
              {place.totalRatings !== undefined && (
                <span className="text-xs text-mutedForeground">
                  ({place.totalRatings.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {place.isOpen !== undefined && (
            <span
              className={cn(
                'text-xs font-medium',
                place.isOpen ? 'text-success' : 'text-destructive'
              )}>
              {place.isOpen ? 'Open now' : 'Closed'}
            </span>
          )}

          <a
            href={place.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-xs text-[#2467B1] hover:underline inline-flex items-center gap-1">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3 h-3 flex-shrink-0">
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            Open in Google Maps
          </a>
        </div>
      </div>
    );
  }
);
GooglePlacesCard.displayName = 'GooglePlacesCard';

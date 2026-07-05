'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

// Taj Mahal as the destination
const TAJ_MAHAL_QUERY = 'Taj+Mahal,+Agra,+Uttar+Pradesh,+India';

/** Fallback embed that just shows Taj Mahal when no location is available. */
const TAJ_MAHAL_ONLY_SRC = `https://maps.google.com/maps?q=${TAJ_MAHAL_QUERY}&output=embed`;

/** Build a directions embed URL from the user's current position to Taj Mahal. */
function buildDirectionsSrc(lat: number, lng: number): string {
  return `https://maps.google.com/maps?saddr=${lat},${lng}&daddr=${TAJ_MAHAL_QUERY}&output=embed`;
}

type LocationState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable';

interface MapModalProps {
  /** Render-prop: receives current open state and should return the trigger element. */
  children: (isOpen: boolean) => React.ReactNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  containerWidth: number | undefined;
}

export default function MapModal({
  children,
  isOpen,
  setIsOpen,
  containerWidth,
}: MapModalProps) {
  const { isDark } = useTheme();
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [mapSrc, setMapSrc] = useState<string>(TAJ_MAHAL_ONLY_SRC);

  /**
   * Track whether we've already requested location for this modal open session
   * so we don't fire the prompt more than once per open.
   */
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes so the next open starts fresh.
      hasRequestedRef.current = false;
      setLocationState('idle');
      setMapSrc(TAJ_MAHAL_ONLY_SRC);
      return;
    }

    // Already requested during this open session — do nothing.
    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    // Geolocation not supported by this browser / device.
    if (!navigator.geolocation) {
      setLocationState('unavailable');
      return;
    }

    setLocationState('requesting');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationState('granted');
        setMapSrc(buildDirectionsSrc(latitude, longitude));
      },
      (_error) => {
        // User denied or the request timed out — fall back to Taj Mahal only.
        setLocationState('denied');
        setMapSrc(TAJ_MAHAL_ONLY_SRC);
      },
      {
        // Don't hammer GPS — network/cell-tower accuracy is fine for routing.
        enableHighAccuracy: false,
        // Accept a cached position up to 5 minutes old.
        maximumAge: 5 * 60 * 1000,
        // Give up if the device doesn't respond within 10 seconds.
        timeout: 10_000,
      }
    );
  }, [isOpen]);

  const heading =
    locationState === 'granted' ? 'Directions to Taj Mahal' : 'Taj Mahal';

  const statusMessage: Record<string, string> = {
    requesting: 'Requesting your location…',
    denied: 'Location access was not granted — showing Taj Mahal on the map.',
    unavailable:
      'Location is unavailable on this device — showing Taj Mahal on the map.',
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children(isOpen)}</DialogTrigger>

      <DialogContent
        showCloseButton={false}
        /* Transparent, non-blurry overlay – same style as the about modal */
        overlayClassName="bg-transparent backdrop-blur-none"
        className={cn(
          'text-foreground border border-black/0 bg-white/60 rounded-[10px] p-5 gap-y-0 items-start shadow-[4px_8px_50px_0px_#00000015] w-full overflow-hidden',
          isDark && 'bg-black/60 border-white/10'
        )}
        style={{ maxWidth: containerWidth ?? 384 }}>
        <div className="flex flex-col gap-y-3 w-full">
          {/* Title */}
          <h2 className={cn('text-sm font-bold', isDark && 'text-white')}>
            {heading}
          </h2>

          {/* Status text (shown while requesting or when access was denied) */}
          {statusMessage[locationState] && (
            <p
              className={cn(
                'text-xs leading-[140%] text-[#1D1D1DCC]',
                isDark && 'text-white/60'
              )}>
              {statusMessage[locationState]}
            </p>
          )}

          {/* Map iframe */}
          <div className="w-full rounded-[8px] overflow-hidden border border-black/5">
            <iframe
              key={mapSrc}
              src={mapSrc}
              width="100%"
              height="300"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={heading}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>

          {/* "Open in Google Maps" deep-link */}
          <a
            href="https://www.google.com/maps/search/?api=1&query=Taj+Mahal,+Agra,+Uttar+Pradesh,+India"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'text-xs text-center text-[#1D1D1DCC] underline hover:text-alias transition-colors',
              isDark && 'text-white/60 hover:text-alias'
            )}>
            Open in Google Maps
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

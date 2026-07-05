'use client';

import { useEffect, useState } from 'react';

import { MOBILE_BREAKPOINT_PX } from '@/lib/constants';

interface DeviceInfo {
  /** True if the viewport width is at or below the mobile breakpoint. */
  isMobileViewport: boolean;
  /** True if the user's device has a mobile-like screen size AND touch/UA heuristics. */
  isMobileDevice: boolean;
  /** True if the component is rendered inside an <iframe>. */
  isInIframe: boolean;
}

/**
 * Detects device type, mobile screen width, and iframe embedding context.
 * All detection is deferred to the browser (no SSR mismatch).
 */
export function useDeviceInfo(): DeviceInfo {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);

    const check = () => {
      const screenWidth = window.screen.width;
      const ua = navigator.userAgent || navigator.vendor;
      const isMobileUA =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          ua.toLowerCase()
        );
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT_PX);
      setIsMobileDevice(screenWidth < 768 || (hasTouch && isMobileUA));
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return { isMobileViewport, isMobileDevice, isInIframe };
}

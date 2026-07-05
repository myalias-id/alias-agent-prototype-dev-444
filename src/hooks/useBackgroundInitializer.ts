'use client';

import { useEffect } from 'react';

import { isPreviewBridgeMode } from '@/lib/preview-bridge';
import useBackgroundStore, { chromaBgs } from '@/store/backgroundStore';
import { IBgProps } from '@/types/agent';

/**
 * Fetches all available backgrounds from the API on application startup
 * and populates the backgroundStore.
 */
export function useBackgroundInitializer() {
  const setAllBackgrounds = useBackgroundStore((s) => s.setAllBackgrounds);
  const setUserAvailableBackgrounds = useBackgroundStore(
    (s) => s.setUserAvailableBackgrounds
  );
  const fetchUpdateTrigger = useBackgroundStore((s) => s.fetchUpdateTrigger);

  useEffect(() => {
    if (isPreviewBridgeMode()) return;

    const fetchBackgrounds = async () => {
      try {
        const response = await fetch('/api/agent/ms-bg', {
          method: 'GET',
          cache: 'no-cache',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { data }: { data: IBgProps[] } = await response.json();

        setAllBackgrounds([...data]);

        const publicBackgrounds = data
          .filter((x) => !x.customBg)
          .sort((a, b) => (a.id > b.id ? 1 : -1));

        const mappedChromaBgs = chromaBgs.map((bg, index) => ({
          ...bg,
          id: 999 + index,
        })) as IBgProps[];

        setUserAvailableBackgrounds([...publicBackgrounds, ...mappedChromaBgs]);
      } catch (error) {
        console.error(
          '[useBackgroundInitializer] Failed to fetch backgrounds:',
          error
        );
      }
    };

    void fetchBackgrounds();
  }, [fetchUpdateTrigger, setAllBackgrounds, setUserAvailableBackgrounds]);
}

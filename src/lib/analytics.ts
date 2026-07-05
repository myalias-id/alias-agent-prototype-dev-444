'use client';

import { sendGAEvent as originalSendGAEvent } from '@next/third-parties/google';

const INTERNAL_TEAM_KEY = 'isInternalTeam';
const INTERNAL_QUERY_PARAM = 'internal';

/**
 * Checks if the current user is an internal team member
 * by checking localStorage flag
 */
export function isInternalTeamMember(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const flag = localStorage.getItem(INTERNAL_TEAM_KEY);
    return flag === 'true';
  } catch {
    // localStorage might not be available (e.g., in private browsing)
    return false;
  }
}

/**
 * Checks URL query parameters for internal team flag
 * and saves it to localStorage if present
 */
export function checkAndSaveInternalTeamFlag(): void {
  if (typeof window === 'undefined') return;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const internalParam = urlParams.get(INTERNAL_QUERY_PARAM);

    if (internalParam === 'true') {
      localStorage.setItem(INTERNAL_TEAM_KEY, 'true');
    }
  } catch (error) {
    // localStorage might not be available
    console.warn('Failed to check/save internal team flag:', error);
  }
}

/**
 * Wrapper for sendGAEvent that checks if user is internal team member
 * and skips sending events if they are
 */
export function sendGAEvent(
  ...args: Parameters<typeof originalSendGAEvent>
): void {
  if (isInternalTeamMember()) {
    // Skip sending GA events for internal team members
    return;
  }

  // Call the original sendGAEvent
  originalSendGAEvent(...args);
}

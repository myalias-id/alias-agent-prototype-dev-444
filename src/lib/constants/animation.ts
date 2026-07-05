/**
 * Shared animation timing and transition constants.
 */

/** Default cross-fade transition duration in seconds. */
export const DEFAULT_TRANSITION_DURATION = 0.8;

/** Default number of idle loops before switching to a new idle animation. */
export const DEFAULT_IDLE_LOOPS = 2;

/** Minimum number of consecutive matching blend-shapes to confirm blend shape category. */
export const MATCH_COUNT_THRESHOLD = 12;

// ── WebSocket / real-time connection ──────────────────────────────────────────

/** Maximum number of consecutive WebSocket reconnection attempts before giving up. */
export const MAX_RECONNECT_ATTEMPTS = 5;

/** Base interval (ms) between reconnection attempts (subject to exponential back-off). */
export const RECONNECT_INTERVAL_MS = 3000;

/** Interval (ms) for the WebSocket health-check ping. */
export const HEALTH_CHECK_INTERVAL_MS = 30000;

/**
 * Shared UI layout and display constants.
 */

/** Viewport width (px) at or below which the app is considered "mobile". */
export const MOBILE_BREAKPOINT_PX = 770;

/** Default brand accent color used when an agent does not provide one. */
export const DEFAULT_ACCENT_COLOR_HEX = '#10C79F';

export const resolveAccentColorHex = (accentColorHex?: string | null) =>
  accentColorHex?.trim() || DEFAULT_ACCENT_COLOR_HEX;

/** Maximum number of chat bubbles allowed on screen simultaneously. */
export const MAX_BUBBLES = 10;

/** Number of recent stream messages to retain in the store. */
export const STREAM_HISTORY_LIMIT = 10;

/**
 * Shared audio analysis and playback constants.
 * Centralises values used across lip-sync, visualizers, and audio recording.
 */

// ── RMS / adaptive analysis ────────────────────────────────────────────────

/** Number of audio samples used per RMS calculation window. */
export const RMS_WINDOW_SIZE = 512;

/** Number of RMS values to retain for adaptive min/max tracking. */
export const HISTORY_WINDOW_SIZE = 60;

/** Minimum RMS value below which audio is treated as silence. */
export const NOISE_FLOOR = 0.001;

/** Rate at which the adaptive min/max levels update to match current audio. */
export const ADAPTATION_RATE = 0.02;

// ── Web Audio API defaults ─────────────────────────────────────────────────

/** FFT size used for frequency-domain audio analysis. Must be a power of 2. */
export const FFT_SIZE = 256;

/** AnalyserNode smoothingTimeConstant — controls how quickly the spectrum smooths (0–1). */
export const SMOOTHING_TIME_CONSTANT = 0.8;

/** RMS threshold below which audio is treated as silence for recording auto-stop. */
export const SILENCE_THRESHOLD = 0.08;

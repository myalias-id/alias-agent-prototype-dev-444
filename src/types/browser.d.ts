/**
 * Augmentations for non-standard browser APIs that are not yet part of TypeScript's
 * built-in lib definitions, eliminating the need for `as any` casts at call sites.
 */

interface Window {
  /** WebkitAudioContext polyfill present in Safari. */
  webkitAudioContext?: typeof AudioContext;
}

interface Navigator {
  /** Legacy getUserMedia polyfill (webkit prefix). */
  webkitGetUserMedia?: Navigator['mediaDevices']['getUserMedia'];
  /** Legacy getUserMedia polyfill (moz prefix). */
  mozGetUserMedia?: Navigator['mediaDevices']['getUserMedia'];
  /** Legacy getUserMedia polyfill (ms prefix). */
  msGetUserMedia?: Navigator['mediaDevices']['getUserMedia'];
}

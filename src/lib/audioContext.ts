// Singleton AudioContext for use across the app, compatible with Safari/iOS
let audioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      ('webkitAudioContext' in window
        ? (window.webkitAudioContext as typeof AudioContext)
        : undefined);
    if (!Ctx) throw new Error('Web Audio API not supported');
    audioContext = new Ctx();
  }
  return audioContext;
}

export async function closeAudioContext(): Promise<void> {
  const ctx = audioContext;
  audioContext = null;

  if (!ctx || ctx.state === 'closed') {
    return;
  }

  await ctx.close();
}

export async function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  // Optionally, play a silent buffer to fully unlock on iOS
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  // Clean up after playback
  source.onended = () => {
    source.disconnect();
  };
}

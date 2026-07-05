type DirectAudioPlaybackOptions = {
  audioBuffer: ArrayBuffer;
  volume: number;
  generation: number;
  isCurrentGeneration: (generation: number) => boolean;
  onAudioNodes: (nodes: { analyser: AnalyserNode; gainNode: GainNode }) => void;
  onComplete: () => void;
  onError: (error: unknown) => void;
};

export async function playAudioDirectly({
  audioBuffer,
  volume,
  generation,
  isCurrentGeneration,
  onAudioNodes,
  onComplete,
  onError,
}: DirectAudioPlaybackOptions): Promise<void> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioCtx();

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const audioBufferDecoded = await audioContext.decodeAudioData(
      audioBuffer.slice(0)
    );

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    onAudioNodes({ analyser, gainNode });

    const source = audioContext.createBufferSource();
    source.buffer = audioBufferDecoded;

    source.connect(analyser);
    source.connect(gainNode);
    if (volume > 0) {
      gainNode.connect(audioContext.destination);
    }

    source.onended = () => {
      if (!isCurrentGeneration(generation)) {
        return;
      }
      onComplete();
    };

    source.start();
  } catch (error) {
    if (!isCurrentGeneration(generation)) {
      return;
    }
    onError(error);
  }
}

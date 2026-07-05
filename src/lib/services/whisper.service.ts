export class WhisperService {
  static async transcribe(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      console.error('Error transcribing audio:', error.message);
      throw new Error(error.message || 'Failed to transcribe audio');
    }

    const payload = (await response.json()) as { data?: { text?: string } };
    if (!payload.data?.text) {
      throw new Error('Transcription response did not include text');
    }

    return payload.data.text;
  }
}

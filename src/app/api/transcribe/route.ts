import { errorResponse, successResponse } from '@/lib/api-response';

// Max audio size: 25 MB (OpenAI Whisper limit)
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const runtime = 'edge';

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse('Transcription service not configured', 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Invalid form data', 400);
  }

  const audioFile = formData.get('file');
  if (!audioFile || !(audioFile instanceof Blob)) {
    return errorResponse('Missing audio file', 400);
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return errorResponse('Audio file too large', 413);
  }

  const outForm = new FormData();
  outForm.append('file', audioFile, 'audio.wav');
  outForm.append('model', 'whisper-1');

  try {
    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: outForm,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI transcription error:', errorText);
      return errorResponse('Transcription failed', response.status);
    }

    const data = (await response.json()) as { text: string };
    return successResponse({ text: data.text });
  } catch (error) {
    console.error('Transcription proxy error:', error);
    return errorResponse('Internal server error', 500);
  }
}

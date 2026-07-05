import { errorResponse, successResponse } from '@/lib/api-response';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(
      `chat-os:generate:${getClientIp(request)}`,
      {
        limit: 20,
        windowMs: 60_000,
      }
    );

    if (rateLimit.allowed === false) {
      return errorResponse('Too many requests', 429, undefined, {
        'Retry-After': rateLimit.retryAfterSeconds.toString(),
      });
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('No messages array provided in request body', 400);
    }

    const MAX_MESSAGES = 50;
    const MAX_MESSAGE_CHARS = 4000;

    if (messages.length > MAX_MESSAGES) {
      return errorResponse('Too many messages', 400);
    }

    const valid = messages.every(
      (m: unknown) =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as { content: unknown }).content === 'string' &&
        (m as { content: string }).content.length <= MAX_MESSAGE_CHARS
    );
    if (!valid) return errorResponse('Invalid message format or size', 400);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return errorResponse('Missing server-side OpenAI API key', 500);
    }

    const openAiRes = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          // model: 'nousresearch/hermes-3-llama-3.1-405b',
          messages: messages,
        }),
      }
    );

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      return errorResponse('OpenAI API Error', openAiRes.status, errText);
    }

    const aiJson = await openAiRes.json();

    // Pass choices back for convenience
    return successResponse({ choices: aiJson?.choices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in /api/chat-os/generate:', error);
    return errorResponse('Server error', 500, message);
  }
}

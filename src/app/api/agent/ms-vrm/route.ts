import {
  errorResponse,
  JSON_HEADERS,
  successResponse,
} from '@/lib/api-response';

export const runtime = 'edge';

export async function GET() {
  const apiUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/vrm`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${process.env.BACKEND_API_ADMIN_SECRET}`,
      },
    });

    if (!response.ok) {
      let message = `HTTP error! status: ${response.status}`;
      try {
        const payload = await response.json();
        message = payload.message ?? payload.error ?? message;
      } catch {
        // Keep status fallback if backend returns a non-JSON error body.
      }
      return errorResponse(message, response.status);
    }

    const data = await response.json();
    return successResponse(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error fetching vrms', error);
    return errorResponse(message, 500);
  }
}

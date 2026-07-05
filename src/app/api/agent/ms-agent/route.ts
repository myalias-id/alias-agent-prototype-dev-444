import { headers } from 'next/headers';

import {
  errorResponse,
  JSON_HEADERS,
  successResponse,
} from '@/lib/api-response';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'edge';

const AGENTS_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(`ms-agent:get:${getClientIp(request)}`, {
    limit: 120,
    windowMs: 60_000,
  });

  if (rateLimit.allowed === false) {
    return errorResponse('Too many requests', 429, undefined, {
      'Retry-After': rateLimit.retryAfterSeconds.toString(),
    });
  }

  const apiUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/agent`;

  try {
    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${process.env.BACKEND_API_ADMIN_SECRET}`,
      },
    });

    // parse the body even if !ok
    const payload = await resp.json();
    if (!resp.ok) {
      // forward the backend’s message or error field
      const msg = payload.message ?? payload.error ?? `HTTP ${resp.status}`;
      return errorResponse(msg, resp.status);
    }

    // success
    return successResponse(payload, 200, AGENTS_CACHE_HEADERS);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  const authHeader = headers().get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  try {
    const resp = await fetch(
      `${process.env.AGENT_BACKEND_API_BASE_URL}/agent`,
      {
        method: 'POST',
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    let payload: unknown = null;
    try {
      payload = await resp.json();
    } catch {
      if (!resp.ok) {
        return errorResponse(`HTTP ${resp.status}`, resp.status);
      }
    }

    if (!resp.ok) {
      const data = (payload as Record<string, string> | null) || {};
      const message = data.error ?? data.message ?? `HTTP ${resp.status}`;
      return errorResponse(message, resp.status);
    }

    return successResponse(payload);
  } catch (e: unknown) {
    // Network / unexpected
    const message = e instanceof Error ? e.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

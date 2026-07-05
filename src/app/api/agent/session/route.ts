import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/api-response';

export const runtime = 'edge';

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error('[AgentSession] Failed to parse request body:', error);
    return errorResponse('Invalid JSON body', 400);
  }

  const { agentId, sessionId, userId } = (body || {}) as {
    agentId?: number | string;
    sessionId?: string;
    userId?: string;
  };

  if (!agentId || !sessionId || !userId) {
    return errorResponse(
      'agentId, sessionId, and userId are required fields',
      400
    );
  }

  const baseUrl = process.env.AGENT_BACKEND_API_BASE_URL;

  if (!baseUrl) {
    console.error('[AgentSession] AGENT_BACKEND_API_BASE_URL not configured');
    return errorResponse('Backend URL not configured', 500);
  }

  const sanitizedBaseUrl = baseUrl.replace(/\/$/, '');
  const targetUrl = `${sanitizedBaseUrl}/agent/${encodeURIComponent(
    agentId
  )}/session`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BACKEND_API_ADMIN_SECRET}`,
      },
      body: JSON.stringify({
        sessionId,
        userId,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => '');
      console.error('[AgentSession] Backend request failed:', {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        body: errorText,
      });

      return errorResponse('Backend request failed', backendResponse.status);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('[AgentSession] Unexpected error:', error);
    return errorResponse('Unexpected error', 500);
  }
}

export function GET() {
  return errorResponse('Method Not Allowed', 405);
}

export const dynamic = 'force-dynamic';

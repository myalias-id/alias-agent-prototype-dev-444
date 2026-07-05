import { headers } from 'next/headers';

import { errorResponse, successResponse } from '@/lib/api-response';

export const runtime = 'edge';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return errorResponse('Missing agent ID in URL.', 400);
    }

    // Possibly retrieve token
    const authHeader = headers().get('authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    const backendUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/agent/${id}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return errorResponse(
        'Failed to fetch agent',
        backendResponse.status,
        errorText
      );
    }

    const data = await backendResponse.json();
    return successResponse(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('Server error', 500, message);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return errorResponse('Missing agent ID in URL.', 400);
    }

    const authHeader = headers().get('authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    const data = await req.json();

    data.bio = data.description ?? null;

    const backendUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/agent/${id}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      const errorJSON = JSON.parse(errorText);
      return errorResponse(
        'Update agent request failed',
        backendResponse.status,
        errorJSON?.error || errorJSON?.message
      );
    }

    const respData = await backendResponse.json();
    return successResponse(respData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('Server error updating agent', 500, message);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return errorResponse('Missing agent ID in URL.', 400);
    }

    // Possibly retrieve token
    const authHeader = headers().get('authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return errorResponse('Auth token not found', 404);
    }

    const backendUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/agent/${id}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return errorResponse(
        'Failed to fetch agent',
        backendResponse.status,
        errorText
      );
    }

    const data = await backendResponse.json();
    return successResponse(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('Server error', 500, message);
  }
}

import { errorResponse, successResponse } from '@/lib/api-response';

export const runtime = 'edge';

export async function GET() {
  const apiUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/bg`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BACKEND_API_ADMIN_SECRET}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return successResponse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('Server error', 500, message);
  }
}

// export const runtime = 'edge';

// import { NextResponse } from 'next/server';

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const path = searchParams.get('path');
//   if (path) {
//     // --- Proxy logic for backgrounds
//     if (path.includes('..')) {
//       return new NextResponse('Invalid path', { status: 400 });
//     }
//     try {
//       const response = await fetch(path);
//       if (!response.ok) {
//         return new NextResponse('Resource not found', {
//           status: response.status,
//         });
//       }

//       const contentType =
//         response.headers.get('content-type') || 'application/octet-stream';
//       const arrayBuffer = await response.arrayBuffer();

//       return new NextResponse(arrayBuffer, {
//         headers: {
//           'Content-Type': contentType,
//           'Cross-Origin-Resource-Policy': 'same-origin',
//           'Cross-Origin-Embedder-Policy': 'require-corp',
//           'Access-Control-Allow-Origin': '*',
//           'Cache-Control': 'public, max-age=3600, immutable',
//         },
//       });
//     } catch (error) {
//       console.error('Error proxying ms-bg:', error);
//       return new NextResponse('Internal Server Error', { status: 500 });
//     }
//   }

//   // Original JSON logic if no “path”
//   try {
//     const apiUrl = `${process.env.AGENT_BACKEND_API_BASE_URL}/bg`;
//     const response = await fetch(apiUrl, {
//       method: 'GET',
//       headers: { 'Content-Type': 'application/json' },
//     });
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     const data = await response.json();
//     return NextResponse.json({ status: 'success', data });
//   } catch (error) {
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

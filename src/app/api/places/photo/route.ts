/** Server-side proxy for Google Places photos, keeping the API key off the client. */

// Validate photo references — Google Places photo refs are long base64url strings
const VALID_PHOTO_REF_REGEX = /^[A-Za-z0-9_-]{10,1600}$/;

export const runtime = 'edge';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref')?.trim() ?? '';
  const maxwidth = Math.min(
    parseInt(searchParams.get('maxwidth') ?? '400', 10) || 400,
    1600
  );

  // Validate ref format to prevent SSRF
  if (!VALID_PHOTO_REF_REGEX.test(ref)) {
    return new Response('Invalid photo reference', { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new Response('Google Places API not configured', { status: 503 });
  }

  const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
  photoUrl.searchParams.set('maxwidth', String(maxwidth));
  photoUrl.searchParams.set('photo_reference', ref);
  photoUrl.searchParams.set('key', apiKey);

  try {
    const resp = await fetch(photoUrl.toString());
    if (!resp.ok) {
      return new Response('Photo fetch failed', { status: resp.status });
    }

    const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
    // Only proxy actual image content types
    if (!contentType.startsWith('image/')) {
      return new Response('Not an image', { status: 400 });
    }

    return new Response(resp.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(message, { status: 500 });
  }
}

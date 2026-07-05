import { errorResponse, successResponse } from '@/lib/api-response';
import { PlaceResult } from '@/types/places';

// Max query length to prevent abuse
const MAX_QUERY_LENGTH = 200;

export const runtime = 'edge';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim().slice(0, MAX_QUERY_LENGTH);

  if (!query) {
    return errorResponse('Missing query parameter "q"', 400);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return errorResponse('Google Places API not configured', 503);
  }

  try {
    const findUrl = new URL(
      'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'
    );
    findUrl.searchParams.set('input', query);
    findUrl.searchParams.set('inputtype', 'textquery');
    findUrl.searchParams.set(
      'fields',
      'place_id,name,formatted_address,rating,user_ratings_total,photos,opening_hours,geometry'
    );
    findUrl.searchParams.set('key', apiKey);

    const resp = await fetch(findUrl.toString());
    if (!resp.ok) {
      return errorResponse(`Google API error: ${resp.status}`, 502);
    }

    const data = (await resp.json()) as {
      status: string;
      candidates?: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        rating?: number;
        user_ratings_total?: number;
        photos?: Array<{ photo_reference: string }>;
        opening_hours?: { open_now?: boolean };
        geometry?: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== 'OK' || !data.candidates?.length) {
      return errorResponse('Place not found', 404);
    }

    const place = data.candidates[0];
    const result: PlaceResult = {
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      photoRef: place.photos?.[0]?.photo_reference,
      isOpen: place.opening_hours?.open_now,
      mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    };

    return successResponse(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

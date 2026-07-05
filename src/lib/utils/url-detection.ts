/** Matches YouTube and other common video platform URLs. */
export const VIDEO_URL_REGEX =
  /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com|dailymotion\.com)\S+/;

/** Matches Spotify track/album/playlist/episode/show/artist URLs. */
export const SPOTIFY_URL_REGEX =
  /https?:\/\/open\.spotify\.com\/(embed\/)?(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/;

/** Matches URLs ending with common image file extensions. */
export const IMAGE_URL_REGEX =
  /https?:\/\/[^\s]*\.(jpg|jpeg|png|gif|bmp|webp|svg|avif|ico)(\?[^\s]*)?/i;

/** Matches URLs with extensions that are definitively NOT images — skip probing these. */
export const KNOWN_NON_IMAGE_REGEX =
  /\.(html?|php|asp|aspx|jsp|pdf|docx?|xlsx?|pptx?|txt|csv|json|xml|js|ts|css|zip|tar\.gz?|rar|mp4|webm|ogg|mp3|wav|flac)(\?[^\s]*)?$/i;

/** Matches Google Maps / Google Places URLs. */
export const GOOGLE_MAPS_URL_REGEX =
  /https?:\/\/(www\.)?(maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/**
 * Extracts a human-readable place name from a Google Maps URL.
 * Returns null for short/redirect URLs (goo.gl) where the name is not in the URL.
 */
export function extractGoogleMapsPlaceName(url: string): string | null {
  // /maps/place/Place+Name/ or /maps/place/Place%20Name/
  const placePathMatch = url.match(/\/maps\/place\/([^/@?#]+)/);
  if (placePathMatch) {
    return decodeURIComponent(placePathMatch[1].replace(/\+/g, ' ')).trim();
  }
  // ?q=Place+Name or &q=Place+Name
  const qParamMatch = url.match(/[?&]q=([^&]+)/);
  if (qParamMatch) {
    return decodeURIComponent(qParamMatch[1].replace(/\+/g, ' ')).trim();
  }
  return null;
}

/**
 * Extracts the YouTube embed URL from a YouTube watch or short URL.
 * Returns null if the URL is not a recognisable YouTube link.
 */
export function getYouTubeEmbedUrl(src: string): string | null {
  const watchMatch = src.match(/youtube\.com\/watch\?v=([^&]+)/i);
  const shortMatch = src.match(/youtu\.be\/([^?&]+)/i);
  const videoId = watchMatch?.[1] ?? shortMatch?.[1] ?? null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

/**
 * Extracts the Spotify embed URL from a Spotify share URL.
 * Returns null if the URL is not a recognisable Spotify link.
 */
export function getSpotifyEmbedUrl(src: string): string | null {
  const match = src.match(
    /open\.spotify\.com\/(embed\/)?(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/
  );
  if (!match) return null;
  return `https://open.spotify.com/embed/${match[2]}/${match[3]}`;
}

/**
 * Probes a URL by loading it as an image.
 * Resolves `true` if the URL serves an image, `false` otherwise.
 */
export function probeImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

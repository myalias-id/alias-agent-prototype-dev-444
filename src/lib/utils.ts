import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── General-purpose utilities ───────────────────────────────────────────────

/**
 * Creates a debounced version of a function that delays execution until after
 * a specified wait time has elapsed since the last call.
 */
export function debounce<F extends (...args: unknown[]) => unknown>(
  func: F,
  wait: number
): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/** Returns a promise that resolves after `ms` milliseconds. */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Returns a random element from the array. */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function parseCookieString(
  cookieString: string
): Record<string, string> {
  return cookieString.split(';').reduce(
    (acc, cookiePart) => {
      const [key, value] = cookiePart.trim().split('=');
      if (key && value) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    },
    {} as Record<string, string>
  );
}

export function formatFollowersCount(followers: number): string {
  if (followers >= 1000000) {
    return `${(followers / 1000000).toFixed(1)}M`;
  }
  if (followers >= 1000) {
    return `${(followers / 1000).toFixed(1)}K`;
  }
  return followers.toString();
}
export function truncateText(text: string, maxLength: number = 20): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseMessageContent(content: string): string {
  if (!content) return content;

  // Normalize newlines so that single newlines become Markdown paragraphs
  let normalized = content
    .replace(/\\n/g, '\n')
    .replace(/(\r?\n)(?!\r?\n)/g, '\n\n')
    // Strip trailing punctuation from URLs so they are not included in the href
    .replace(/((?:https?:\/\/|www\.)\S+?)[.,;:!?"')]+(?=\s|$)/g, '$1');

  // Wrap bare URLs in explicit Markdown links so characters like a trailing "_"
  // are treated as part of the URL, not as Markdown emphasis markers.
  // Matches URLs preceded by whitespace, ":", or start-of-string so that
  // patterns like "description:https://x.com/aliasapp_" (no space) are also
  // handled correctly.
  normalized = normalized.replace(
    /(^|[\s:])((?:https?:\/\/|www\.)[^\s<]+)/g,
    (_match, prefix: string, url: string) => {
      return `${prefix}[${url}](${url})`;
    }
  );

  return normalized;
}

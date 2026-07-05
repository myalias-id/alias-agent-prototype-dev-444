/**
 * Chat utility functions for parsing and transforming bot responses.
 * Handles JSON parsing, emotion/animation extraction, and text cleanup.
 */

import { debounce, delay, randomElement } from '../utils';

type BotResponse = {
  text: string;
  facial_emotion: string;
  anim_to_play: string;
};

/** Valid facial emotions the LLM may return. */
const VALID_EMOTIONS = [
  'happy',
  'joy',
  'joyful',
  'excited',
  'fun',
  'playful',
  'delighted',
  'sad',
  'sorrow',
  'down',
  'melancholy',
  'depressed',
  'angry',
  'anger',
  'annoyed',
  'mad',
  'frustrated',
  'furious',
  'relaxed',
  'neutral',
  'blink',
  'blinkleft',
  'blinkright',
  'lookup',
  'lookdown',
  'lookleft',
  'lookright',
] as const;

/** Valid animation names the LLM may return (derived from public/vrma filenames). */
const VALID_ANIMS = [
  'idle_1',
  'idle_2',
  'idle_3',
  'idle_4',
  'idle_5',
  'idle_6',
  'idle_7',
  'idle_8',
  'idle_9',
  'idle_waiting',
  'idle_waiting2',
  'idle_waiting3',
  'idle_waiting4',
  'idle_waiting5',
  'idle_waiting6',
  'talking_angry',
  'talking_angry1',
  'talking_angry2',
  'talking_angry4',
  'talking_fun',
  'talking_joy',
  'talking_neutral1',
  'talking_neutral2',
  'talking_neutral8',
  'talking_neutral9',
  'talking_sorrow1',
  'talking_sorrow2',
] as const;

const stripFences = (raw: string) => raw.replace(/```json|```/gi, '').trim();
const fixEscapes = (src: string) => src.replace(/\\'/g, "'");

const jsonSafeParse = (src: string): BotResponse | null => {
  try {
    const p = JSON.parse(fixEscapes(src));
    const emotion = (p.facial_emotion ?? '').toLowerCase().trim();
    const anim = (p.anim_to_play ?? '').toLowerCase().trim();
    return {
      text: p.text ?? '',
      facial_emotion: VALID_EMOTIONS.includes(
        emotion as (typeof VALID_EMOTIONS)[number]
      )
        ? emotion
        : 'neutral',
      anim_to_play: VALID_ANIMS.includes(anim as (typeof VALID_ANIMS)[number])
        ? anim
        : 'idle_1',
    };
  } catch {
    return null;
  }
};

function parseSocketResponse(chunk: string): BotResponse {
  const trimmed = chunk.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // Try direct parse first — structural newlines are valid JSON whitespace
    const direct = jsonSafeParse(trimmed);
    if (direct) return direct;
    // Fall back to escaped parse for text values that contain literal newlines
    const escaped = trimmed
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    const ok = jsonSafeParse(escaped);
    if (ok) return ok;
  }

  if (trimmed.includes('```')) {
    const stripped = stripFences(trimmed);
    // Try direct parse first — structural newlines are valid JSON whitespace
    const direct = jsonSafeParse(stripped);
    if (direct) return direct;
    // Fall back to escaped parse for text values that contain literal newlines
    const escaped = stripped
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    const ok = jsonSafeParse(escaped);
    if (ok) return ok;
  }

  const kvRe = /"?(text|facial_emotion|anim_to_play)"?\s*:\s*"([\s\S]*?)"/gis;
  let text = '';
  let facial: string | undefined;
  let anim: string | undefined;
  let firstMatchIndex: number | null = null;
  let lastMatchEnd = 0;
  let m: RegExpExecArray | null;

  while ((m = kvRe.exec(trimmed))) {
    if (firstMatchIndex === null) firstMatchIndex = m.index;
    lastMatchEnd = m.index + m[0].length;
    switch (m[1]) {
      case 'text':
        text = m[2].trim();
        break;
      case 'facial_emotion':
        facial = m[2].trim();
        break;
      case 'anim_to_play':
        anim = m[2].trim();
        break;
    }
  }

  if (!text) {
    const prefix =
      firstMatchIndex !== null
        ? trimmed
            .slice(0, firstMatchIndex)
            .replace(/^[{"\s,]+/, '')
            .replace(/[,"{}\s]+$/, '')
            .trim()
        : trimmed;
    text = prefix;
  }

  if (lastMatchEnd > 0) {
    const overflow = trimmed
      .slice(lastMatchEnd)
      .replace(/^[}\s,'"]+/, '')
      .trim();
    if (overflow) text = text ? text + '\n\n' + overflow : overflow;
  }

  const normalizedFacial = (facial ?? '').toLowerCase().trim();
  const normalizedAnim = (anim ?? '').toLowerCase().trim();
  return {
    text,
    facial_emotion: VALID_EMOTIONS.includes(
      normalizedFacial as (typeof VALID_EMOTIONS)[number]
    )
      ? normalizedFacial
      : 'neutral',
    anim_to_play: VALID_ANIMS.includes(
      normalizedAnim as (typeof VALID_ANIMS)[number]
    )
      ? normalizedAnim
      : 'idle_1',
  };
}

/**
 * Strips a trailing ``` fence that has no matching opening fence (i.e. it's
 * an artefact from the backend wrapping the JSON in a code block).
 */
function stripTrailingCodeFence(text: string): string {
  const stripped = text.trimEnd();
  if (!stripped.endsWith('```')) return text;
  const withoutFence = stripped.slice(0, -3).trimEnd();
  // Count opening fences — if balanced, leave as-is; if orphaned, remove.
  const openCount = (withoutFence.match(/^```/gm) ?? []).length;
  const closeCount = (stripped.match(/^```\s*$/gm) ?? []).length;
  return openCount >= closeCount ? text : withoutFence;
}

/**
 * Extracts displayable text from a raw bot response string.
 * Strips JSON structure, leaving only the human-readable text.
 */
function extractChatText(raw: string): string {
  if (!raw) return raw;

  const jsonMatch = raw.match(/\{[\s\S]*?"text"\s*:[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.text && typeof parsed.text === 'string') {
        const afterJson = raw
          .slice(raw.indexOf(jsonMatch[0]) + jsonMatch[0].length)
          .trim()
          .replace(/^```\w*\s*\n?/, '') // strip orphaned closing code-fence the agent wraps JSON in
          .trim();
        const text = stripTrailingCodeFence(parsed.text);
        return afterJson ? text + '\n\n' + afterJson : text;
      }
    } catch {
      // fall through
    }
  }

  const animPattern = VALID_ANIMS.join('|');
  const emotionPattern = VALID_EMOTIONS.join('|');
  const cleaned = raw
    .replace(/^\s*\{\s*"text"\s*:\s*"?/i, '')
    .replace(/"?\s*,?\s*"facial_emotion"\s*:\s*"[^"]*"/g, '')
    .replace(/"?\s*,?\s*"anim_to_play"\s*:\s*"[^"]*"/g, '')
    .replace(new RegExp(`\\b(${animPattern})\\b`, 'gi'), '')
    .replace(new RegExp(`\\b(${emotionPattern})\\b`, 'gi'), '')
    .replace(/[{}"]\s*$/g, '')
    .replace(/^\s*[{}"]\s*/g, '')
    .trim();

  return cleaned || raw.trim();
}

export {
  debounce,
  delay,
  extractChatText,
  parseSocketResponse,
  randomElement,
  VALID_ANIMS,
  VALID_EMOTIONS,
};

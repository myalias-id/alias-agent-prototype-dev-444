/**
 * Animation data and helper utilities for the VRM store.
 * Extracted to keep vrmStore.ts focused on state management.
 */

/** Idle animation clip names (maps to /public/vrma/Idle_*.vrma files). */
export const idleAnimations: string[] = [
  'Idle_2',
  'Idle_3',
  'idle_4',
  'idle_5',
  'idle_6',
  'idle_7',
  'idle_8',
  'idle_9',
];

/** Waiting animation clip names (maps to /public/vrma/idle_waiting*.vrma files). */
export const waitingAnimations: string[] = [
  'idle_waiting',
  'idle_waiting2',
  'idle_waiting3',
  'idle_waiting4',
  'idle_waiting5',
  'idle_waiting6',
];

/**
 * Emotion-keyed animation arrays for random selection.
 * Only includes emotions returned by the chat system.
 */
export const emotionAnimationArrays: Record<string, string[]> = {
  happy: [
    'Talking_Joy',
    'Talking_Fun',
    'Talking_Neutral1',
    'Talking_Neutral2',
    'talking_neutral8',
    'talking_neutral9',
  ],
  joy: [
    'Talking_Joy',
    'Talking_Fun',
    'Talking_Neutral1',
    'Talking_Neutral2',
    'talking_neutral8',
    'talking_neutral9',
  ],
  fun: ['Talking_Fun', 'Talking_Joy', 'Talking_Neutral1', 'Talking_Neutral2'],
  angry: [
    'Talking_Angry',
    'Talking_Angry1',
    'Talking_Angry2',
    'talking_angry4',
    'Talking_Neutral1',
    'Talking_Neutral2',
  ],
  sorrow: [
    'Talking_Sorrow1',
    'Talking_Sorrow2',
    'Talking_Neutral1',
    'Talking_Neutral2',
  ],
  sad: [
    'Talking_Sorrow1',
    'Talking_Sorrow2',
    'Talking_Neutral1',
    'Talking_Neutral2',
  ],
  relaxed: [
    'Talking_Neutral1',
    'Talking_Neutral2',
    'talking_neutral8',
    'talking_neutral9',
  ],
  neutral: [
    'Talking_Neutral1',
    'Talking_Neutral2',
    'talking_neutral8',
    'talking_neutral9',
  ],
  default: [
    'Talking_Neutral1',
    'Talking_Neutral2',
    'talking_neutral8',
    'talking_neutral9',
  ],
};

/**
 * Returns true if the animation filename implies it should loop
 * (i.e., contains 'idle' or 'loop').
 */
export function shouldLoopAnimation(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes('idle') || lower.includes('loop');
}

/**
 * Infers the animation type from its filename.
 */
export function getAnimationType(filename: string): 'idle' | 'talk' | 'action' {
  const lower = filename.toLowerCase();
  if (lower.includes('idle')) return 'idle';
  if (lower.includes('talk') || lower.includes('talking')) return 'talk';
  return 'action';
}

/**
 * Picks a random animation name for the given emotion, avoiding the last-played
 * animation where possible.
 */
export function getEmotionAnimationName(
  emotion: string,
  lastPlayed: string | null = null
): string {
  const lowerEmotion = emotion.toLowerCase().trim();

  let animationArray = emotionAnimationArrays[lowerEmotion] ?? [];

  if (animationArray.length === 0) {
    for (const [key, value] of Object.entries(emotionAnimationArrays)) {
      if (lowerEmotion.includes(key) || key.includes(lowerEmotion)) {
        animationArray = value;
        break;
      }
    }
  }

  if (animationArray.length === 0) {
    animationArray = emotionAnimationArrays.default;
  }

  const available = lastPlayed
    ? animationArray.filter((a) => a !== lastPlayed)
    : animationArray;

  const pool = available.length > 0 ? available : animationArray;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Returns the full animation array for the given emotion.
 */
export function getEmotionAnimationArray(emotion: string): string[] {
  const lower = emotion.toLowerCase().trim();

  if (emotionAnimationArrays[lower]) return emotionAnimationArrays[lower];

  for (const [key, value] of Object.entries(emotionAnimationArrays)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }

  return emotionAnimationArrays.default;
}

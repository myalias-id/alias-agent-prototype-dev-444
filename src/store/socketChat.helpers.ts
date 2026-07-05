import { VRMExpressionPresetName } from '@pixiv/three-vrm';

import { Model } from '@/components/vrm/Model';
import useAgentStore from '@/store/useAgentStore';
import useVRMStore from '@/store/vrmStore';
import { VoiceInstructionCategory } from '@/types/agent';

/**
 * Maps a facial emotion string from the server to a VRM expression preset name.
 * @param emotion The emotion string (e.g., "happy", "sad").
 * @returns The corresponding VRMExpressionPresetName.
 */
export function mapFacialEmotionToVRM(
  emotion: string
): VRMExpressionPresetName {
  const emotionMap: Record<string, VRMExpressionPresetName> = {
    happy: 'happy',
    joy: 'happy',
    sad: 'sad',
    sorrow: 'sad',
    angry: 'angry',
    relaxed: 'relaxed',
    neutral: 'neutral',
    blink: 'blink',
    blinkLeft: 'blinkLeft',
    blinkRight: 'blinkRight',
    lookUp: 'lookUp',
    lookDown: 'lookDown',
    lookLeft: 'lookLeft',
    lookRight: 'lookRight',
  };

  const normalizedEmotion = emotion.toLowerCase().trim();
  return emotionMap[normalizedEmotion] || 'neutral';
}

/**
 * Maps incoming facial emotion strings to animation categories that the VRM
 * animation controller understands.
 */
export function mapFacialEmotionToAnimation(emotion: string): string {
  const normalized = emotion.toLowerCase().trim();

  if (
    [
      'joy',
      'joyful',
      'happy',
      'excited',
      'fun',
      'playful',
      'delighted',
    ].includes(normalized)
  ) {
    return 'happy';
  }

  if (
    ['angry', 'anger', 'annoyed', 'mad', 'frustrated', 'furious'].includes(
      normalized
    )
  ) {
    return 'angry';
  }

  if (
    ['sad', 'sorrow', 'down', 'melancholy', 'depressed'].includes(normalized)
  ) {
    return 'sad';
  }

  return 'neutral';
}

/**
 * Resets the VRM model to a neutral expression and its default idle animation.
 * Typically called after speech or an action animation finishes.
 * @param model The `Model` instance to reset.
 */
export function resetVRMToIdle(model: Model) {
  try {
    if (model.emoteController) {
      model.emoteController.playEmotion('neutral');
    }
    if (model.actionAnimation) {
      model.stopActionAnimation();
    }

    const { selectedAgent, allAgents } = useAgentStore.getState();
    const foundAgent = allAgents.find((a) => a.id === selectedAgent);

    let idleAnimationId: number | null = null;
    if (foundAgent?.animations) {
      const idleEntry = foundAgent.animations.find(
        (anim) => anim.state === 'IDLE'
      );
      if (idleEntry?.animationId) {
        idleAnimationId = idleEntry.animationId;
      }
    }

    if (!idleAnimationId) {
      const { animationDictionary } = useVRMStore.getState();
      const vrmaIdleAnimation = animationDictionary.find(
        (anim) => anim.name.toLowerCase().includes('idle') && anim.loop
      );
      if (vrmaIdleAnimation) {
        idleAnimationId = vrmaIdleAnimation.id;
      }
    }

    if (idleAnimationId) {
      void useVRMStore.getState().playIdleAnimationById(idleAnimationId);
    }
  } catch (error) {
    console.error('[SocketChat] Error resetting VRM to idle:', error);
  }
}

/**
 * Formats voice instructions into a single string for the TTS API.
 * @param instructions An object containing voice instruction categories.
 * @returns A formatted string of instructions.
 */
export function voiceInstructionsStringHelper(
  instructions: VoiceInstructionCategory = {
    style: '',
    pacing: '',
    pronunciation: '',
    affect: '',
    pitch: '',
  }
): string {
  return [
    'Voice should be high quality.',
    instructions?.style ? `Style: ${instructions.style}` : '',
    instructions?.pacing ? `Pacing: ${instructions.pacing}` : '',
    instructions?.pronunciation
      ? `Pronunciation: ${instructions.pronunciation}`
      : '',
    instructions?.affect ? `Affect: ${instructions.affect}` : '',
    instructions?.pitch ? `Pitch: ${instructions.pitch}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

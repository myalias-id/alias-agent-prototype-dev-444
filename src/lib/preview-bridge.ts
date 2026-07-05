'use client';

export type PreviewBridgeType =
  | 'alias-preview:ready'
  | 'alias-preview:config'
  | 'alias-preview:sendMessage'
  | 'alias-preview:messageResult'
  | 'alias-preview:ttsRequest'
  | 'alias-preview:ttsResult'
  | 'alias-preview:error';

export type PreviewBridgeMessage<TPayload = Record<string, unknown>> =
  TPayload & {
    nonce: string;
    requestId?: string;
    type: PreviewBridgeType;
  };

const BRIDGE_TIMEOUT_MS = 60_000;

function getSearchParams() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search);
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isPreviewBridgeMode() {
  const params = getSearchParams();
  return (
    params?.get('preview') === '1' &&
    params?.get('chatTransport') === 'parentBridge'
  );
}

export function getPreviewBridgeNonce() {
  return getSearchParams()?.get('bridgeNonce') || '';
}

function isMessageFromParent(event: MessageEvent) {
  return event.source === window.parent;
}

export function postPreviewBridgeMessage<TPayload extends object>(
  type: PreviewBridgeType,
  payload?: TPayload
) {
  if (typeof window === 'undefined' || !isPreviewBridgeMode()) return;
  const nonce = getPreviewBridgeNonce();
  if (!nonce) return;

  window.parent.postMessage({ ...(payload || {}), nonce, type }, '*');
}

export function addPreviewBridgeListener<TPayload = Record<string, unknown>>(
  type: PreviewBridgeType,
  handler: (
    message: PreviewBridgeMessage<TPayload>,
    event: MessageEvent
  ) => void
) {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: MessageEvent) => {
    if (!isMessageFromParent(event)) return;
    const data = event.data as PreviewBridgeMessage<TPayload> | null;
    if (!data || data.type !== type || data.nonce !== getPreviewBridgeNonce()) {
      return;
    }
    handler(data, event);
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function sendPreviewBridgeRequest<
  TPayload extends object,
  TResult = Record<string, unknown>,
>(type: PreviewBridgeType, expectedType: PreviewBridgeType, payload: TPayload) {
  return new Promise<PreviewBridgeMessage<TResult>>((resolve, reject) => {
    if (typeof window === 'undefined' || !isPreviewBridgeMode()) {
      reject(new Error('Preview bridge is not available.'));
      return;
    }

    const requestId = createRequestId();
    const nonce = getPreviewBridgeNonce();
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', listener);
      reject(new Error('Preview bridge request timed out.'));
    }, BRIDGE_TIMEOUT_MS);

    const listener = (event: MessageEvent) => {
      if (!isMessageFromParent(event)) return;
      const data = event.data as PreviewBridgeMessage<TResult> | null;
      if (
        !data ||
        data.nonce !== nonce ||
        data.requestId !== requestId ||
        (data.type !== expectedType && data.type !== 'alias-preview:error')
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener('message', listener);

      if (data.type === 'alias-preview:error') {
        reject(new Error(String((data as Record<string, unknown>).message)));
        return;
      }

      resolve(data);
    };

    window.addEventListener('message', listener);
    postPreviewBridgeMessage(type, { ...payload, requestId });
  });
}

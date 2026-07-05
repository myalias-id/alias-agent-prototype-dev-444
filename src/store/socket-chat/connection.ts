import { HEALTH_CHECK_INTERVAL_MS } from '@/lib/constants';

export function generateUUID() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    console.warn('crypto.randomUUID not available, using fallback');
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getChatGatewayUrl(): string {
  let gatewayUrl = process.env.NEXT_PUBLIC_AGENT_CHAT_GATEWAY || '';

  if (!gatewayUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    gatewayUrl = `${protocol}//${window.location.host}/api/chat-os/generate`;
  }

  try {
    const url = new URL(gatewayUrl);
    const isLocalGateway =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.local');

    if (url.protocol === 'ws:' && !isLocalGateway) {
      url.protocol = 'wss:';
      return url.toString();
    }

    if (
      url.protocol === 'wss:' &&
      isLocalGateway &&
      window.location.protocol === 'http:'
    ) {
      url.protocol = 'ws:';
      return url.toString();
    }
  } catch {
    if (
      window.location.protocol === 'https:' &&
      gatewayUrl.startsWith('ws://')
    ) {
      return gatewayUrl.replace('ws://', 'wss://');
    }
  }

  return gatewayUrl;
}

export function startHealthCheck(
  socket: WebSocket,
  reconnect: () => void
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
      return;
    }

    if (
      socket.readyState === WebSocket.CLOSED ||
      socket.readyState === WebSocket.CLOSING
    ) {
      reconnect();
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

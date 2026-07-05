export function notifyBackendAboutSession(
  agentId: number | null | undefined,
  userId?: string,
  sessionId?: string
) {
  if (!agentId || !userId || !sessionId) {
    return;
  }

  void fetch('/api/agent/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      sessionId,
      userId,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        console.warn('Session save failed:', response.status);
      }
    })
    .catch((error) => {
      console.warn('Session save error:', error);
    });
}

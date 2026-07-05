export interface ResponseContent {
  content: {
    parts: Array<{
      text: string;
    }>;
    role: string;
  };
  usage_metadata: {
    candidates_token_count: number;
    candidates_tokens_details: Array<{
      modality: string;
      token_count: number;
    }>;
    prompt_token_count: number;
    prompt_tokens_details: Array<{
      modality: string;
      token_count: number;
    }>;
    thoughts_token_count: number;
    total_token_count: number;
    traffic_type: string;
  };
  invocation_id: string;
  author: string;
  actions: {
    state_delta: Record<string, unknown>;
    artifact_delta: Record<string, unknown>;
    requested_auth_configs: Record<string, unknown>;
  };
  id: string;
  timestamp: number;
}

/**
 * Extracts the text content from a WebSocket message response.
 */
export function extractMessageText(
  data: ResponseContent | null
): string | null {
  try {
    return data?.content?.parts[0]?.text || '';
  } catch (error) {
    console.error('[parseResponse] Error extracting message text:', error);
    return null;
  }
}

/**
 * Parses a raw WebSocket message string into a structured response object.
 */
export function parseMessageResponse(data: string): ResponseContent | null {
  try {
    return JSON.parse(data) as ResponseContent;
  } catch (error) {
    console.error('[parseResponse] Error parsing message response:', error);
    return null;
  }
}

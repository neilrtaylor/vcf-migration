// AI Chat API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, sendChatMessage } from './aiProxyClient';
import type { ChatRequest, ChatResponse, ChatContext } from './types';

const logger = createLogger('AI Chat');

/**
 * Send a chat message to the AI proxy
 */
export async function sendMessage(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  context?: ChatContext
): Promise<ChatResponse> {
  if (!isAIProxyConfigured()) {
    throw new Error('AI proxy not configured');
  }

  logger.info('Sending chat message');

  const request: ChatRequest = {
    message,
    conversationHistory,
    context,
  };

  return sendChatMessage(request, { timeout: 60000 });
}

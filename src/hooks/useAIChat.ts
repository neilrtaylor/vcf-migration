// AI Chat hook - manages chat state, messages, and history

import { useState, useCallback } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { sendMessage } from '@/services/ai/aiChatApi';
import type { ChatMessage, ChatContext } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  suggestedFollowUps: string[];
  sendUserMessage: (message: string, context?: ChatContext) => Promise<void>;
  clearConversation: () => void;
  isAvailable: boolean;
}

let nextMessageId = 1;

function createMessageId(): string {
  return `msg-${Date.now()}-${nextMessageId++}`;
}

/**
 * Hook for AI chat functionality
 * Conversation is ephemeral (not persisted to localStorage)
 */
export function useAIChat(): UseAIChatReturn {
  const { settings } = useAISettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const sendUserMessage = useCallback(async (message: string, context?: ChatContext) => {
    if (!isAvailable) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Build conversation history (limit to last 20 messages)
      const history = [...messages, userMessage]
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendMessage(message, history, context);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setSuggestedFollowUps(response.suggestedFollowUps || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, messages]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setSuggestedFollowUps([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    suggestedFollowUps,
    sendUserMessage,
    clearConversation,
    isAvailable,
  };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIChat } from './useAIChat';

// Mock dependencies
vi.mock('@/services/ai/aiProxyClient', () => ({
  isAIProxyConfigured: vi.fn(() => true),
}));

vi.mock('@/services/ai/aiChatApi', () => ({
  sendMessage: vi.fn(() =>
    Promise.resolve({
      response: 'Test response',
      suggestedFollowUps: ['Follow up 1'],
      model: 'test-model',
      processingTimeMs: 100,
    })
  ),
}));

vi.mock('./useAISettings', () => ({
  useAISettings: vi.fn(() => ({
    settings: { enabled: true, consentGiven: true },
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  })),
}));

describe('useAIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty messages', () => {
    const { result } = renderHook(() => useAIChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isAvailable).toBe(true);
  });

  it('sends user message and receives response', async () => {
    const { result } = renderHook(() => useAIChat());

    await act(async () => {
      await result.current.sendUserMessage('Hello');
    });

    // Should have 2 messages: user + assistant
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Hello');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Test response');
  });

  it('clears conversation', async () => {
    const { result } = renderHook(() => useAIChat());

    await act(async () => {
      await result.current.sendUserMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearConversation();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.suggestedFollowUps).toEqual([]);
  });

  it('sets suggested follow-ups from response', async () => {
    const { result } = renderHook(() => useAIChat());

    await act(async () => {
      await result.current.sendUserMessage('Hello');
    });

    expect(result.current.suggestedFollowUps).toEqual(['Follow up 1']);
  });
});

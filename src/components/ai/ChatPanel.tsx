// Shared Chat UI component - used by both ChatWidget and ChatPage

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  TextInput,
  Button,
  Tag,
  InlineNotification,
  InlineLoading,
} from '@carbon/react';
import { Send, TrashCan, Renew } from '@carbon/icons-react';
import type { ChatMessage, ChatContext } from '@/services/ai/types';
import { useAIChat } from '@/hooks/useAIChat';
import { useData } from '@/hooks';
import { buildChatContext } from '@/services/ai/chatContextBuilder';
import { useLocation } from 'react-router-dom';
import './ChatPanel.scss';

interface ChatPanelProps {
  className?: string;
}

export function ChatPanel({ className = '' }: ChatPanelProps) {
  const { rawData, analysis } = useData();
  const location = useLocation();
  const {
    messages,
    isLoading,
    error,
    suggestedFollowUps,
    sendUserMessage,
    clearConversation,
    isAvailable,
  } = useAIChat();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = useCallback((): ChatContext | undefined => {
    return buildChatContext(rawData, analysis, location.pathname);
  }, [rawData, analysis, location.pathname]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    setInputValue('');
    await sendUserMessage(trimmed, buildContext());
    inputRef.current?.focus();
  }, [inputValue, isLoading, sendUserMessage, buildContext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestedClick = useCallback(
    (question: string) => {
      sendUserMessage(question, buildContext());
    },
    [sendUserMessage, buildContext]
  );

  if (!isAvailable) {
    return (
      <div className={`chat-panel ${className}`}>
        <div className="chat-panel__empty">
          <p>AI features are not available. Enable AI in Settings and configure the AI proxy URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-panel ${className}`}>
      {/* Messages area */}
      <div className="chat-panel__messages">
        {messages.length === 0 && (
          <div className="chat-panel__welcome">
            <h5>Migration Assistant</h5>
            <p>
              Ask questions about your VMware environment, migration planning,
              IBM Cloud ROKS, or VPC VSI options.
            </p>
            {suggestedFollowUps.length === 0 && (
              <div className="chat-panel__suggestions">
                <SuggestedQuestions
                  questions={getDefaultSuggestions(location.pathname)}
                  onClick={handleSuggestedClick}
                />
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="chat-panel__loading">
            <InlineLoading status="active" description="Thinking..." />
          </div>
        )}

        {error && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error}
            lowContrast
            hideCloseButton
            className="chat-panel__error"
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested follow-ups */}
      {suggestedFollowUps.length > 0 && !isLoading && (
        <div className="chat-panel__suggestions">
          <SuggestedQuestions
            questions={suggestedFollowUps}
            onClick={handleSuggestedClick}
          />
        </div>
      )}

      {/* Input area */}
      <div className="chat-panel__input-area">
        <TextInput
          id="chat-input"
          labelText=""
          hideLabel
          placeholder="Ask about your migration..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          disabled={isLoading}
          size="lg"
        />
        <Button
          kind="primary"
          size="lg"
          renderIcon={Send}
          iconDescription="Send"
          hasIconOnly
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
        />
        <Button
          kind="ghost"
          size="lg"
          renderIcon={messages.length > 0 ? TrashCan : Renew}
          iconDescription={messages.length > 0 ? 'Clear conversation' : 'Refresh'}
          hasIconOnly
          onClick={clearConversation}
          disabled={isLoading && messages.length === 0}
        />
      </div>
    </div>
  );
}

// ===== SUB-COMPONENTS =====

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-panel__message chat-panel__message--${message.role}`}>
      <div className="chat-panel__bubble">
        {!isUser && (
          <Tag type="purple" size="sm" className="chat-panel__ai-tag">
            AI
          </Tag>
        )}
        <div className="chat-panel__text">
          {message.content.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuggestedQuestions({
  questions,
  onClick,
}: {
  questions: string[];
  onClick: (q: string) => void;
}) {
  return (
    <div className="chat-panel__suggestion-chips">
      {questions.map((q, i) => (
        <Button
          key={i}
          kind="ghost"
          size="sm"
          onClick={() => onClick(q)}
          className="chat-panel__suggestion-chip"
        >
          {q}
        </Button>
      ))}
    </div>
  );
}

function getDefaultSuggestions(pathname: string): string[] {
  if (pathname.includes('dashboard')) {
    return [
      'What are the biggest migration risks?',
      'Summarize my environment',
      'Which VMs should I migrate first?',
    ];
  }
  if (pathname.includes('roks')) {
    return [
      'Which VMs are best suited for ROKS?',
      'What blockers need remediation?',
      'Explain OpenShift Virtualization',
    ];
  }
  if (pathname.includes('vsi')) {
    return [
      'Which VMs appear over-provisioned?',
      'How can I optimize costs?',
      'What profile family for databases?',
    ];
  }
  if (pathname.includes('discovery') || pathname.includes('wave')) {
    return [
      'Is my wave plan balanced?',
      'Which wave has the most risk?',
      'How should I group dependent VMs?',
    ];
  }
  return [
    'What is ROKS migration?',
    'Explain VSI vs ROKS approaches',
    'What is OpenShift Virtualization?',
  ];
}

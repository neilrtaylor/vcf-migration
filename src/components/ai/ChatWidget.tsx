// Floating Chat Widget - bottom-right overlay that persists across page navigation

import { useState, useCallback } from 'react';
import { Button, Tooltip } from '@carbon/react';
import { Chat, Close } from '@carbon/icons-react';
import { ChatPanel } from './ChatPanel';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { useAISettings } from '@/hooks/useAISettings';
import './ChatWidget.scss';

export function ChatWidget() {
  const { settings } = useAISettings();
  const [isOpen, setIsOpen] = useState(false);
  const isConfigured = isAIProxyConfigured();
  const isAvailable = isConfigured && settings.enabled;

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Fully hide when proxy is not configured at all
  if (!isConfigured) {
    return null;
  }

  // Show disabled state when configured but AI is toggled off
  if (!isAvailable) {
    return (
      <div className="chat-widget">
        <Tooltip
          label="AI features are disabled. Enable them in Settings."
          align="left"
        >
          <Button
            className="chat-widget__trigger chat-widget__trigger--disabled"
            kind="primary"
            renderIcon={Chat}
            iconDescription="AI assistant (disabled)"
            hasIconOnly
            size="lg"
            disabled
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-widget__panel">
          <div className="chat-widget__panel-header">
            <h4>Migration Assistant</h4>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Close}
              iconDescription="Close chat"
              hasIconOnly
              onClick={toggleChat}
            />
          </div>
          <ChatPanel className="chat-widget__chat-panel" />
        </div>
      )}

      <Button
        className="chat-widget__trigger"
        kind="primary"
        renderIcon={isOpen ? Close : Chat}
        iconDescription={isOpen ? 'Close chat' : 'Open migration assistant'}
        hasIconOnly
        size="lg"
        onClick={toggleChat}
      />
    </div>
  );
}

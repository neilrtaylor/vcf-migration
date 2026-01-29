// AI Status Badge - compact indicator showing AI feature availability

import { Tag } from '@carbon/react';
import { WatsonHealthAiResults, CloudOffline } from '@carbon/icons-react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { useAISettings } from '@/hooks/useAISettings';

export function AIStatusBadge() {
  const { settings } = useAISettings();
  const isConfigured = isAIProxyConfigured();

  // Don't render if proxy isn't configured at all
  if (!isConfigured) {
    return null;
  }

  if (settings.enabled) {
    return (
      <Tag type="purple" size="sm" title="AI features are active">
        <WatsonHealthAiResults size={12} />
        &nbsp;AI Active
      </Tag>
    );
  }

  return (
    <Tag type="gray" size="sm" title="AI features are disabled">
      <CloudOffline size={12} />
      &nbsp;AI Off
    </Tag>
  );
}

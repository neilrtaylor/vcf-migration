// AI Remediation Panel - displays AI-generated remediation guidance for blockers

import {
  Tile,
  Tag,
  Button,
  InlineLoading,
  InlineNotification,
  OrderedList,
  UnorderedList,
  ListItem,
  SkeletonText,
  Link,
  Accordion,
  AccordionItem,
} from '@carbon/react';
import { WatsonHealthAiResults, Renew, CloudOffline } from '@carbon/icons-react';
import type { RemediationInput, RemediationResult } from '@/services/ai/types';
import { useAIRemediation } from '@/hooks/useAIRemediation';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { useEffect } from 'react';
import { ROUTES } from '@/utils/constants';
import './AIRemediationPanel.scss';

interface AIRemediationPanelProps {
  data: RemediationInput | null;
  title?: string;
}

export function AIRemediationPanel({
  data,
  title = 'AI Remediation Guidance',
}: AIRemediationPanelProps) {
  const { guidance, isLoading, error, fetchGuidance, isAvailable } = useAIRemediation();

  useEffect(() => {
    if (data && isAvailable && !guidance && !isLoading) {
      fetchGuidance(data);
    }
  }, [data, isAvailable, guidance, isLoading, fetchGuidance]);

  if (!isAvailable) {
    const isConfigured = isAIProxyConfigured();
    if (!isConfigured) {
      return null;
    }
    return (
      <Tile className="ai-remediation-panel ai-remediation-panel--unavailable">
        <div className="ai-remediation-panel__header">
          <div className="ai-remediation-panel__title">
            <CloudOffline size={20} />
            <h4>{title}</h4>
            <Tag type="gray" size="sm">AI Unavailable</Tag>
          </div>
        </div>
        <p className="ai-remediation-panel__unavailable-text">
          AI features are disabled.{' '}
          <Link href={ROUTES.settings}>Enable in Settings</Link>
        </p>
      </Tile>
    );
  }

  return (
    <Tile className="ai-remediation-panel">
      <div className="ai-remediation-panel__header">
        <div className="ai-remediation-panel__title">
          <WatsonHealthAiResults size={20} />
          <h4>{title}</h4>
          <Tag type="purple" size="sm">AI</Tag>
        </div>
        {guidance && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Renew}
            iconDescription="Refresh guidance"
            hasIconOnly
            onClick={() => data && fetchGuidance(data)}
            disabled={isLoading}
          />
        )}
      </div>

      {isLoading && (
        <div className="ai-remediation-panel__loading">
          <InlineLoading
            status="active"
            description="Generating remediation guidance with watsonx.ai..."
          />
          <div className="ai-remediation-panel__skeleton">
            <SkeletonText heading width="60%" />
            <SkeletonText paragraph lineCount={3} />
          </div>
        </div>
      )}

      {error && (
        <InlineNotification
          kind="warning"
          title="AI remediation guidance unavailable"
          subtitle={error}
          lowContrast
          hideCloseButton
        />
      )}

      {guidance && !isLoading && (
        <RemediationContent guidance={guidance} />
      )}
    </Tile>
  );
}

function RemediationContent({ guidance }: { guidance: RemediationResult }) {
  // Safely access guidance array with fallback to empty array
  const guidanceItems = Array.isArray(guidance.guidance) ? guidance.guidance : [];

  return (
    <div className="ai-remediation-panel__content">
      {guidanceItems.length > 0 ? (
        <Accordion>
          {guidanceItems.map((g, i) => {
            // Safely access steps and alternatives with fallbacks
            const steps = Array.isArray(g?.steps) ? g.steps : [];
            const alternatives = Array.isArray(g?.alternatives) ? g.alternatives : [];
            const blockerType = g?.blockerType || 'Unknown Blocker';
            const estimatedEffort = g?.estimatedEffort || 'Unknown';

            return (
              <AccordionItem
                key={i}
                title={
                  <div className="ai-remediation-panel__accordion-title">
                    <span>{blockerType}</span>
                    <Tag type="outline" size="sm">{estimatedEffort}</Tag>
                  </div>
                }
              >
                <div className="ai-remediation-panel__guidance">
                  {steps.length > 0 && (
                    <div className="ai-remediation-panel__section">
                      <h5>Remediation Steps</h5>
                      <OrderedList>
                        {steps.map((step, j) => (
                          <ListItem key={j}>{step}</ListItem>
                        ))}
                      </OrderedList>
                    </div>
                  )}

                  {alternatives.length > 0 && (
                    <div className="ai-remediation-panel__section">
                      <h5>Alternatives</h5>
                      <UnorderedList>
                        {alternatives.map((alt, j) => (
                          <ListItem key={j}>{alt}</ListItem>
                        ))}
                      </UnorderedList>
                    </div>
                  )}

                  {steps.length === 0 && alternatives.length === 0 && (
                    <p>No remediation details available for this blocker.</p>
                  )}
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <p className="ai-remediation-panel__empty">
          No remediation guidance available. The AI did not return actionable steps.
        </p>
      )}

      <div className="ai-remediation-panel__footer">
        <Tag type="gray" size="sm">
          Source: {guidance.source === 'watsonx' ? 'watsonx.ai' : guidance.source || 'unknown'}
        </Tag>
      </div>
    </div>
  );
}

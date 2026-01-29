// AI Insights Panel - reusable component for displaying AI-generated migration insights

import {
  Tile,
  Tag,
  Button,
  InlineLoading,
  InlineNotification,
  OrderedList,
  ListItem,
  SkeletonText,
  Link,
} from '@carbon/react';
import { WatsonHealthAiResults, Renew, CloudOffline } from '@carbon/icons-react';
import type { MigrationInsights, InsightsInput } from '@/services/ai/types';
import { useAIInsights } from '@/hooks/useAIInsights';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { useEffect } from 'react';
import { ROUTES } from '@/utils/constants';
import './AIInsightsPanel.scss';

interface AIInsightsPanelProps {
  data: InsightsInput | null;
  title?: string;
  compact?: boolean;
}

export function AIInsightsPanel({
  data,
  title = 'AI Migration Insights',
  compact = false,
}: AIInsightsPanelProps) {
  const { insights, isLoading, error, fetchInsights, refreshInsights, isAvailable } = useAIInsights();

  // Auto-fetch when data is provided and AI is available
  useEffect(() => {
    if (data && isAvailable && !insights && !isLoading) {
      fetchInsights(data);
    }
  }, [data, isAvailable, insights, isLoading, fetchInsights]);

  if (!isAvailable) {
    const isConfigured = isAIProxyConfigured();
    // Fully hide when proxy is not configured
    if (!isConfigured) {
      return null;
    }
    // Show unavailable state when configured but disabled
    return (
      <Tile className={`ai-insights-panel ${compact ? 'ai-insights-panel--compact' : ''} ai-insights-panel--unavailable`}>
        <div className="ai-insights-panel__header">
          <div className="ai-insights-panel__title">
            <CloudOffline size={20} />
            <h4>{title}</h4>
            <Tag type="gray" size="sm">AI Unavailable</Tag>
          </div>
        </div>
        <p className="ai-insights-panel__unavailable-text">
          AI features are disabled.{' '}
          <Link href={ROUTES.settings}>Enable in Settings</Link>
        </p>
      </Tile>
    );
  }

  return (
    <Tile className={`ai-insights-panel ${compact ? 'ai-insights-panel--compact' : ''}`}>
      <div className="ai-insights-panel__header">
        <div className="ai-insights-panel__title">
          <WatsonHealthAiResults size={20} />
          <h4>{title}</h4>
          <Tag type="purple" size="sm">AI</Tag>
        </div>
        {insights && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Renew}
            iconDescription="Refresh insights"
            hasIconOnly
            onClick={() => data && refreshInsights(data)}
            disabled={isLoading}
          />
        )}
      </div>

      {isLoading && (
        <div className="ai-insights-panel__loading">
          <InlineLoading
            status="active"
            description="Generating insights with watsonx.ai..."
          />
          {!compact && (
            <div className="ai-insights-panel__skeleton">
              <SkeletonText heading width="60%" />
              <SkeletonText paragraph lineCount={3} />
            </div>
          )}
        </div>
      )}

      {error && (
        <InlineNotification
          kind="warning"
          title="AI insights unavailable"
          subtitle={error}
          lowContrast
          hideCloseButton
        />
      )}

      {insights && !isLoading && (
        <InsightsContent insights={insights} compact={compact} />
      )}
    </Tile>
  );
}

function InsightsContent({
  insights,
  compact,
}: {
  insights: MigrationInsights;
  compact: boolean;
}) {
  // Defensive: ensure arrays exist (LLM might not always return all fields)
  const recommendations = insights.recommendations || [];
  const costOptimizations = insights.costOptimizations || [];

  if (compact) {
    return (
      <div className="ai-insights-panel__content">
        <p className="ai-insights-panel__summary">{insights.executiveSummary || 'No summary available.'}</p>
        {recommendations.length > 0 && (
          <div className="ai-insights-panel__section">
            <strong>Top recommendation:</strong>
            <p>{recommendations[0]}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ai-insights-panel__content">
      {insights.executiveSummary && (
        <div className="ai-insights-panel__section">
          <h5>Executive Summary</h5>
          <p>{insights.executiveSummary}</p>
        </div>
      )}

      {insights.riskAssessment && (
        <div className="ai-insights-panel__section">
          <h5>Risk Assessment</h5>
          <p>{insights.riskAssessment}</p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="ai-insights-panel__section">
          <h5>Recommendations</h5>
          <OrderedList>
            {recommendations.map((rec, i) => (
              <ListItem key={i}>{rec}</ListItem>
            ))}
          </OrderedList>
        </div>
      )}

      {costOptimizations.length > 0 && (
        <div className="ai-insights-panel__section">
          <h5>Cost Optimizations</h5>
          <OrderedList>
            {costOptimizations.map((opt, i) => (
              <ListItem key={i}>{opt}</ListItem>
            ))}
          </OrderedList>
        </div>
      )}

      {insights.migrationStrategy && (
        <div className="ai-insights-panel__section">
          <h5>Migration Strategy</h5>
          <p>{insights.migrationStrategy}</p>
        </div>
      )}

      <div className="ai-insights-panel__footer">
        <Tag type="gray" size="sm">
          Source: {insights.source === 'watsonx' ? 'watsonx.ai' : insights.source || 'AI'}
        </Tag>
      </div>
    </div>
  );
}

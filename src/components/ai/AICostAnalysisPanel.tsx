// AI Cost Analysis Panel - displays AI-generated cost optimization recommendations

import {
  Tile,
  Tag,
  Button,
  InlineLoading,
  InlineNotification,
  UnorderedList,
  ListItem,
  SkeletonText,
  Link,
} from '@carbon/react';
import { WatsonHealthAiResults, Renew, CloudOffline } from '@carbon/icons-react';
import type { CostOptimizationInput, CostOptimizationResult } from '@/services/ai/types';
import { useAICostOptimization } from '@/hooks/useAICostOptimization';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { useEffect } from 'react';
import { ROUTES } from '@/utils/constants';
import './AICostAnalysisPanel.scss';

interface AICostAnalysisPanelProps {
  data: CostOptimizationInput | null;
  title?: string;
}

export function AICostAnalysisPanel({
  data,
  title = 'AI Cost Optimization',
}: AICostAnalysisPanelProps) {
  const { optimization, isLoading, error, fetchOptimization, isAvailable } = useAICostOptimization();

  useEffect(() => {
    if (data && isAvailable && !optimization && !isLoading) {
      fetchOptimization(data);
    }
  }, [data, isAvailable, optimization, isLoading, fetchOptimization]);

  if (!isAvailable) {
    const isConfigured = isAIProxyConfigured();
    if (!isConfigured) {
      return null;
    }
    return (
      <Tile className="ai-cost-analysis-panel ai-cost-analysis-panel--unavailable">
        <div className="ai-cost-analysis-panel__header">
          <div className="ai-cost-analysis-panel__title">
            <CloudOffline size={20} />
            <h4>{title}</h4>
            <Tag type="gray" size="sm">AI Unavailable</Tag>
          </div>
        </div>
        <p className="ai-cost-analysis-panel__unavailable-text">
          AI features are disabled.{' '}
          <Link href={ROUTES.settings}>Enable in Settings</Link>
        </p>
      </Tile>
    );
  }

  return (
    <Tile className="ai-cost-analysis-panel">
      <div className="ai-cost-analysis-panel__header">
        <div className="ai-cost-analysis-panel__title">
          <WatsonHealthAiResults size={20} />
          <h4>{title}</h4>
          <Tag type="purple" size="sm">AI</Tag>
        </div>
        {optimization && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Renew}
            iconDescription="Refresh analysis"
            hasIconOnly
            onClick={() => data && fetchOptimization(data)}
            disabled={isLoading}
          />
        )}
      </div>

      {isLoading && (
        <div className="ai-cost-analysis-panel__loading">
          <InlineLoading
            status="active"
            description="Analyzing costs with watsonx.ai..."
          />
          <div className="ai-cost-analysis-panel__skeleton">
            <SkeletonText heading width="60%" />
            <SkeletonText paragraph lineCount={3} />
          </div>
        </div>
      )}

      {error && (
        <InlineNotification
          kind="warning"
          title="AI cost analysis unavailable"
          subtitle={error}
          lowContrast
          hideCloseButton
        />
      )}

      {optimization && !isLoading && (
        <CostAnalysisContent optimization={optimization} />
      )}
    </Tile>
  );
}

function CostAnalysisContent({ optimization }: { optimization: CostOptimizationResult }) {
  const priorityColors: Record<string, 'red' | 'teal' | 'gray'> = {
    high: 'red',
    medium: 'teal',
    low: 'gray',
  };

  // Defensive: ensure arrays exist (LLM might not always return all fields)
  const recommendations = optimization.recommendations || [];
  const architectureRecommendations = optimization.architectureRecommendations || [];

  return (
    <div className="ai-cost-analysis-panel__content">
      {recommendations.length > 0 && (
        <div className="ai-cost-analysis-panel__section">
          <h5>Recommendations</h5>
          <div className="ai-cost-analysis-panel__recommendations">
            {recommendations.map((rec, i) => (
              <div key={i} className="ai-cost-analysis-panel__recommendation">
                <div className="ai-cost-analysis-panel__recommendation-header">
                  <Tag type={priorityColors[rec.priority] || 'gray'} size="sm">
                    {rec.priority || 'medium'}
                  </Tag>
                  <strong>{rec.category || 'General'}</strong>
                  {rec.estimatedSavings && (
                    <Tag type="green" size="sm">{rec.estimatedSavings}</Tag>
                  )}
                </div>
                <p>{rec.description || 'No description available.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {architectureRecommendations.length > 0 && (
        <div className="ai-cost-analysis-panel__section">
          <h5>Architecture Recommendations</h5>
          <UnorderedList>
            {architectureRecommendations.map((rec, i) => (
              <ListItem key={i}>{rec}</ListItem>
            ))}
          </UnorderedList>
        </div>
      )}

      <div className="ai-cost-analysis-panel__footer">
        <Tag type="gray" size="sm">
          Source: {optimization.source === 'watsonx' ? 'watsonx.ai' : optimization.source || 'AI'}
        </Tag>
      </div>
    </div>
  );
}

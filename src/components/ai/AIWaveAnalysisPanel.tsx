// AI Wave Analysis Panel - displays AI-generated wave planning suggestions

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
  Accordion,
  AccordionItem,
} from '@carbon/react';
import { WatsonHealthAiResults, Renew, CloudOffline } from '@carbon/icons-react';
import type { WaveSuggestionInput, WaveSuggestionResult } from '@/services/ai/types';
import { useAIWaveSuggestions } from '@/hooks/useAIWaveSuggestions';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { useEffect } from 'react';
import { ROUTES } from '@/utils/constants';
import './AIWaveAnalysisPanel.scss';

interface AIWaveAnalysisPanelProps {
  data: WaveSuggestionInput | null;
  title?: string;
}

export function AIWaveAnalysisPanel({
  data,
  title = 'AI Wave Analysis',
}: AIWaveAnalysisPanelProps) {
  const { suggestions, isLoading, error, fetchSuggestions, isAvailable } = useAIWaveSuggestions();

  useEffect(() => {
    if (data && isAvailable && !suggestions && !isLoading) {
      fetchSuggestions(data);
    }
  }, [data, isAvailable, suggestions, isLoading, fetchSuggestions]);

  if (!isAvailable) {
    const isConfigured = isAIProxyConfigured();
    if (!isConfigured) {
      return null;
    }
    return (
      <Tile className="ai-wave-analysis-panel ai-wave-analysis-panel--unavailable">
        <div className="ai-wave-analysis-panel__header">
          <div className="ai-wave-analysis-panel__title">
            <CloudOffline size={20} />
            <h4>{title}</h4>
            <Tag type="gray" size="sm">AI Unavailable</Tag>
          </div>
        </div>
        <p className="ai-wave-analysis-panel__unavailable-text">
          AI features are disabled.{' '}
          <Link href={ROUTES.settings}>Enable in Settings</Link>
        </p>
      </Tile>
    );
  }

  return (
    <Tile className="ai-wave-analysis-panel">
      <div className="ai-wave-analysis-panel__header">
        <div className="ai-wave-analysis-panel__title">
          <WatsonHealthAiResults size={20} />
          <h4>{title}</h4>
          <Tag type="purple" size="sm">AI</Tag>
        </div>
        {suggestions && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Renew}
            iconDescription="Refresh analysis"
            hasIconOnly
            onClick={() => data && fetchSuggestions(data)}
            disabled={isLoading}
          />
        )}
      </div>

      {isLoading && (
        <div className="ai-wave-analysis-panel__loading">
          <InlineLoading
            status="active"
            description="Analyzing waves with watsonx.ai..."
          />
          <div className="ai-wave-analysis-panel__skeleton">
            <SkeletonText heading width="60%" />
            <SkeletonText paragraph lineCount={3} />
          </div>
        </div>
      )}

      {error && (
        <InlineNotification
          kind="warning"
          title="AI wave analysis unavailable"
          subtitle={error}
          lowContrast
          hideCloseButton
        />
      )}

      {suggestions && !isLoading && (
        <WaveAnalysisContent suggestions={suggestions} />
      )}
    </Tile>
  );
}

function WaveAnalysisContent({ suggestions }: { suggestions: WaveSuggestionResult }) {
  // Defensive: ensure arrays exist (LLM might not always return all fields)
  const suggestionsList = suggestions.suggestions || [];
  const dependencyWarnings = suggestions.dependencyWarnings || [];
  const riskNarratives = suggestions.riskNarratives || [];

  return (
    <div className="ai-wave-analysis-panel__content">
      {suggestionsList.length > 0 && (
        <div className="ai-wave-analysis-panel__section">
          <h5>Suggestions</h5>
          <UnorderedList>
            {suggestionsList.map((s, i) => (
              <ListItem key={i}>{s}</ListItem>
            ))}
          </UnorderedList>
        </div>
      )}

      {dependencyWarnings.length > 0 && (
        <div className="ai-wave-analysis-panel__section">
          <h5>Dependency Warnings</h5>
          <UnorderedList>
            {dependencyWarnings.map((w, i) => (
              <ListItem key={i}>{w}</ListItem>
            ))}
          </UnorderedList>
        </div>
      )}

      {riskNarratives.length > 0 && (
        <div className="ai-wave-analysis-panel__section">
          <h5>Wave Risk Assessment</h5>
          <Accordion>
            {riskNarratives.map((rn, i) => (
              <AccordionItem title={rn.waveName || `Wave ${i + 1}`} key={i}>
                <p>{rn.narrative || 'No risk narrative available.'}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      <div className="ai-wave-analysis-panel__footer">
        <Tag type="gray" size="sm">
          Source: {suggestions.source === 'watsonx' ? 'watsonx.ai' : suggestions.source || 'AI'}
        </Tag>
      </div>
    </div>
  );
}

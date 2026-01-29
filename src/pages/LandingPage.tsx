// Landing page with file upload
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Column, Tile, Tag } from '@carbon/react';
import { WatsonHealthAiResults } from '@carbon/icons-react';
import { FileUpload } from '@/components/upload';
import { useData } from '@/hooks';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import type { RVToolsData } from '@/types';
import { ROUTES } from '@/utils/constants';
import './LandingPage.scss';

export function LandingPage() {
  const navigate = useNavigate();
  const { setRawData, setError } = useData();

  const handleDataParsed = useCallback(
    (data: RVToolsData) => {
      setRawData(data);
      // Navigate to dashboard after successful upload
      navigate(ROUTES.dashboard);
    },
    [setRawData, navigate]
  );

  const handleError = useCallback(
    (errors: string[]) => {
      setError(errors.join(', '));
    },
    [setError]
  );

  return (
    <div className="landing-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <div className="landing-page__header">
            <h1>RVTools Analysis & Migration Assessment</h1>
            <p className="landing-page__description">
              Upload your RVTools Excel export to analyze your VMware infrastructure
              and assess migration readiness for IBM Cloud (ROKS + OpenShift Virtualization).
            </p>
          </div>
        </Column>

        <Column lg={{ span: 8, offset: 4 }} md={8} sm={4}>
          <Tile className="landing-page__upload-tile">
            <FileUpload
              onDataParsed={handleDataParsed}
              onError={handleError}
            />
            <p className="landing-page__privacy-note">
              Your data stays private — files are processed entirely in your browser and never uploaded to any server.
            </p>
          </Tile>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="landing-page__features">
            <h2>What you'll get</h2>
            <Grid>
              <Column lg={4} md={4} sm={4}>
                <Tile className="landing-page__feature-tile">
                  <h3>Executive Summary</h3>
                  <p>High-level overview of your VMware infrastructure with key metrics and health indicators.</p>
                </Tile>
              </Column>
              <Column lg={4} md={4} sm={4}>
                <Tile className="landing-page__feature-tile">
                  <h3>Compute Analysis</h3>
                  <p>CPU and memory distribution, top consumers, and resource utilization insights.</p>
                </Tile>
              </Column>
              <Column lg={4} md={4} sm={4}>
                <Tile className="landing-page__feature-tile">
                  <h3>Storage Analysis</h3>
                  <p>Datastore capacity, provisioning types, and storage consumption patterns.</p>
                </Tile>
              </Column>
              <Column lg={4} md={4} sm={4}>
                <Tile className="landing-page__feature-tile">
                  <h3>Migration Readiness</h3>
                  <p>MTV pre-flight checks, OS compatibility scoring, and migration complexity assessment.</p>
                </Tile>
              </Column>
            </Grid>
          </div>
        </Column>

        {isAIProxyConfigured() && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="landing-page__ai-tile">
              <div className="landing-page__ai-header">
                <WatsonHealthAiResults size={24} />
                <h3>Enhanced with AI</h3>
                <Tag type="purple" size="sm">watsonx.ai</Tag>
              </div>
              <p className="landing-page__ai-description">
                This application is connected to IBM watsonx.ai for AI-powered analysis. When enabled in Settings, you'll also get:
              </p>
              <Grid>
                <Column lg={4} md={4} sm={4}>
                  <div className="landing-page__ai-feature">
                    <strong>Workload Classification</strong>
                    <p>LLM-based workload detection with confidence scoring for each VM.</p>
                  </div>
                </Column>
                <Column lg={4} md={4} sm={4}>
                  <div className="landing-page__ai-feature">
                    <strong>Migration Insights</strong>
                    <p>Executive summaries, risk assessments, and actionable recommendations.</p>
                  </div>
                </Column>
                <Column lg={4} md={4} sm={4}>
                  <div className="landing-page__ai-feature">
                    <strong>Cost Optimization</strong>
                    <p>Right-sizing suggestions and prioritized cost reduction recommendations.</p>
                  </div>
                </Column>
                <Column lg={4} md={4} sm={4}>
                  <div className="landing-page__ai-feature">
                    <strong>AI-Enhanced Reports</strong>
                    <p>DOCX, PDF, and Excel exports enriched with AI-generated analysis.</p>
                  </div>
                </Column>
              </Grid>
            </Tile>
          </Column>
        )}
      </Grid>
    </div>
  );
}

// Settings page - AI configuration, proxy status, cache management, and override resets

import { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Column,
  Tile,
  Toggle,
  Tag,
  Button,
  InlineNotification,
} from '@carbon/react';
import {
  Checkmark,
  CloudOffline,
  ConnectionSignal,
  TrashCan,
  Reset,
  Settings as SettingsIcon,
} from '@carbon/icons-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useAIStatus } from '@/hooks/useAIStatus';
import { clearClassificationCache } from '@/services/ai/aiClassificationCache';
import { clearRightsizingCache } from '@/services/ai/aiRightsizingCache';
import { clearInsightsCache } from '@/services/ai/aiInsightsCache';
import { clearPricingCache } from '@/services/pricing/pricingCache';
import { clearProfilesCache } from '@/services/profiles/profilesCache';
import { isProxyConfigured, testProxyConnection } from '@/services/pricing/globalCatalogApi';
import { isProfilesProxyConfigured, testProfilesProxyConnection } from '@/services/ibmCloudProfilesApi';
import './SettingsPage.scss';

export function SettingsPage() {
  const { settings, updateSettings } = useAISettings();
  const { isConfigured, proxyHealth, isTestingProxy, testProxy } = useAIStatus();

  // Pricing proxy status
  const pricingProxyConfigured = isProxyConfigured();
  const [pricingProxyHealth, setPricingProxyHealth] = useState<{ success: boolean; error?: string } | null>(null);
  const [isTestingPricingProxy, setIsTestingPricingProxy] = useState(false);

  const testPricingProxy = useCallback(async () => {
    setIsTestingPricingProxy(true);
    try {
      const result = await testProxyConnection();
      setPricingProxyHealth(result);
    } catch {
      setPricingProxyHealth({ success: false, error: 'Unexpected error' });
    } finally {
      setIsTestingPricingProxy(false);
    }
  }, []);

  // Profiles proxy status
  const profilesProxyConfigured = isProfilesProxyConfigured();
  const [profilesProxyHealth, setProfilesProxyHealth] = useState<{ success: boolean; error?: string } | null>(null);
  const [isTestingProfilesProxy, setIsTestingProfilesProxy] = useState(false);

  const testProfilesProxy = useCallback(async () => {
    setIsTestingProfilesProxy(true);
    try {
      const result = await testProfilesProxyConnection();
      setProfilesProxyHealth(result);
    } catch {
      setProfilesProxyHealth({ success: false, error: 'Unexpected error' });
    } finally {
      setIsTestingProfilesProxy(false);
    }
  }, []);

  // Auto-test proxy on mount if configured
  useEffect(() => {
    if (isConfigured && !proxyHealth) {
      testProxy();
    }
    if (pricingProxyConfigured && !pricingProxyHealth) {
      testPricingProxy();
    }
    if (profilesProxyConfigured && !profilesProxyHealth) {
      testProfilesProxy();
    }
  }, [isConfigured, proxyHealth, testProxy, pricingProxyConfigured, pricingProxyHealth, testPricingProxy, profilesProxyConfigured, profilesProxyHealth, testProfilesProxy]);

  // Override reset state
  const [resetNotification, setResetNotification] = useState<string | null>(null);

  const handleResetVMOverrides = useCallback(() => {
    localStorage.removeItem('vcf-vm-overrides');
    setResetNotification('VM overrides have been cleared.');
  }, []);

  const handleResetSubnetOverrides = useCallback(() => {
    localStorage.removeItem('vcf-subnet-overrides');
    setResetNotification('Subnet overrides have been cleared.');
  }, []);

  const handleResetProfileOverrides = useCallback(() => {
    localStorage.removeItem('vcf-profile-overrides');
    localStorage.removeItem('vcf-custom-profiles');
    setResetNotification('Profile overrides and custom profiles have been cleared.');
  }, []);

  const handleResetAllOverrides = useCallback(() => {
    localStorage.removeItem('vcf-vm-overrides');
    localStorage.removeItem('vcf-subnet-overrides');
    localStorage.removeItem('vcf-profile-overrides');
    localStorage.removeItem('vcf-custom-profiles');
    setResetNotification('All overrides have been cleared.');
  }, []);

  const handleClearClassificationCache = useCallback(() => {
    clearClassificationCache();
  }, []);

  const handleClearRightsizingCache = useCallback(() => {
    clearRightsizingCache();
  }, []);

  const handleClearInsightsCache = useCallback(() => {
    clearInsightsCache();
  }, []);

  const handleClearAllCaches = useCallback(() => {
    clearClassificationCache();
    clearRightsizingCache();
    clearInsightsCache();
  }, []);

  const handleClearPricingCache = useCallback(() => {
    clearPricingCache();
  }, []);

  const handleClearProfilesCache = useCallback(() => {
    clearProfilesCache();
  }, []);

  const handleClearAllDataCaches = useCallback(() => {
    clearPricingCache();
    clearProfilesCache();
  }, []);

  return (
    <div className="settings-page">
      <Grid>
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <h1 className="settings-page__title">Settings</h1>
          <p className="settings-page__subtitle">
            Configure AI features and manage application settings
          </p>
        </Column>

        {/* AI Features */}
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <SettingsIcon size={20} />
              AI Features
            </h2>

            <div className="settings-page__toggle-row">
              <Toggle
                id="ai-enabled-toggle"
                labelText="Enable AI features"
                labelA="Off"
                labelB="On"
                toggled={settings.enabled}
                onToggle={(checked: boolean) => {
                  updateSettings({ enabled: checked });
                  if (!checked) {
                    updateSettings({ enabled: false, consentGiven: false });
                  }
                }}
                disabled={!isConfigured}
              />
            </div>

            {!isConfigured && (
              <InlineNotification
                kind="info"
                title="AI proxy not configured"
                subtitle="Set the VITE_AI_PROXY_URL environment variable to enable AI features."
                lowContrast
                hideCloseButton
              />
            )}

            {isConfigured && settings.enabled && !settings.consentGiven && (
              <div className="settings-page__consent">
                <InlineNotification
                  kind="warning"
                  title="Consent required"
                  subtitle="AI features send aggregated migration data (VM counts, resource totals, workload categories) to IBM watsonx.ai. No individual VM names, IPs, or raw data is transmitted."
                  lowContrast
                  hideCloseButton
                />
                <Button
                  kind="primary"
                  size="sm"
                  onClick={() => updateSettings({ consentGiven: true })}
                  style={{ marginTop: '0.5rem' }}
                >
                  I understand and consent
                </Button>
              </div>
            )}

            {isConfigured && settings.enabled && settings.consentGiven && (
              <div className="settings-page__privacy-notice">
                <p>
                  AI features are active. Only aggregated summaries are sent to watsonx.ai.
                  Individual VM names, IPs, and raw RVTools data are never transmitted.
                </p>
              </div>
            )}
          </Tile>
        </Column>

        {/* Proxy Status Section Header */}
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '0.5rem' }}>
          <h3 className="settings-page__row-heading">Proxy Connections</h3>
        </Column>

        {/* AI Proxy Status */}
        <Column lg={5} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <ConnectionSignal size={20} />
              AI Proxy Status
            </h2>

            <div className="settings-page__status-row">
              <span className="settings-page__status-label">Connection</span>
              {!isConfigured ? (
                <Tag type="gray" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Not Configured
                </Tag>
              ) : proxyHealth === null ? (
                <Tag type="gray" size="sm">Untested</Tag>
              ) : proxyHealth.success ? (
                <Tag type="green" size="sm">
                  <Checkmark size={12} />
                  &nbsp;Connected
                </Tag>
              ) : (
                <Tag type="red" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Unavailable
                </Tag>
              )}
            </div>

            {proxyHealth && !proxyHealth.success && proxyHealth.error && (
              <p className="settings-page__error-detail">{proxyHealth.error}</p>
            )}

            <Button
              kind="tertiary"
              size="sm"
              onClick={testProxy}
              disabled={!isConfigured || isTestingProxy}
              style={{ marginTop: '1rem' }}
            >
              {isTestingProxy ? 'Testing...' : 'Test Connection'}
            </Button>
          </Tile>
        </Column>

        {/* Pricing Proxy Status */}
        <Column lg={5} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <ConnectionSignal size={20} />
              Pricing Proxy Status
            </h2>

            <div className="settings-page__status-row">
              <span className="settings-page__status-label">Connection</span>
              {!pricingProxyConfigured ? (
                <Tag type="gray" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Not Configured
                </Tag>
              ) : pricingProxyHealth === null ? (
                <Tag type="gray" size="sm">Untested</Tag>
              ) : pricingProxyHealth.success ? (
                <Tag type="green" size="sm">
                  <Checkmark size={12} />
                  &nbsp;Connected
                </Tag>
              ) : (
                <Tag type="red" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Unavailable
                </Tag>
              )}
            </div>

            {pricingProxyHealth && !pricingProxyHealth.success && pricingProxyHealth.error && (
              <p className="settings-page__error-detail">{pricingProxyHealth.error}</p>
            )}

            <Button
              kind="tertiary"
              size="sm"
              onClick={testPricingProxy}
              disabled={!pricingProxyConfigured || isTestingPricingProxy}
              style={{ marginTop: '1rem' }}
            >
              {isTestingPricingProxy ? 'Testing...' : 'Test Connection'}
            </Button>
          </Tile>
        </Column>

        {/* Profiles Proxy Status */}
        <Column lg={6} md={8} sm={4} style={{ marginBottom: '1rem' }}>

          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <ConnectionSignal size={20} />
              Profiles Proxy Status
            </h2>

            <div className="settings-page__status-row">
              <span className="settings-page__status-label">Connection</span>
              {!profilesProxyConfigured ? (
                <Tag type="gray" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Not Configured
                </Tag>
              ) : profilesProxyHealth === null ? (
                <Tag type="gray" size="sm">Untested</Tag>
              ) : profilesProxyHealth.success ? (
                <Tag type="green" size="sm">
                  <Checkmark size={12} />
                  &nbsp;Connected
                </Tag>
              ) : (
                <Tag type="red" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Unavailable
                </Tag>
              )}
            </div>

            {profilesProxyHealth && !profilesProxyHealth.success && profilesProxyHealth.error && (
              <p className="settings-page__error-detail">{profilesProxyHealth.error}</p>
            )}

            <Button
              kind="tertiary"
              size="sm"
              onClick={testProfilesProxy}
              disabled={!profilesProxyConfigured || isTestingProfilesProxy}
              style={{ marginTop: '1rem' }}
            >
              {isTestingProfilesProxy ? 'Testing...' : 'Test Connection'}
            </Button>
          </Tile>
        </Column>

        {/* Cache Management */}
        <Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <TrashCan size={20} />
              AI Cache
            </h2>
            <p className="settings-page__cache-description">
              AI results are cached locally for 24 hours. Clear caches to force fresh analysis.
            </p>

            <div className="settings-page__cache-actions">
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearClassificationCache}
              >
                Clear Classification Cache
              </Button>
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearRightsizingCache}
              >
                Clear Right-sizing Cache
              </Button>
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearInsightsCache}
              >
                Clear Insights Cache
              </Button>
              <Button
                kind="danger--tertiary"
                size="sm"
                onClick={handleClearAllCaches}
                renderIcon={TrashCan}
              >
                Clear All AI Caches
              </Button>
            </div>
          </Tile>
        </Column>

        {/* Data Cache Management */}
        <Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <TrashCan size={20} />
              Data Cache
            </h2>
            <p className="settings-page__cache-description">
              Pricing and profile data are cached locally for 24 hours. Clear to fetch fresh data from IBM Cloud.
            </p>

            <div className="settings-page__cache-actions">
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearPricingCache}
              >
                Clear Pricing Cache
              </Button>
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearProfilesCache}
              >
                Clear Profiles Cache
              </Button>
              <Button
                kind="danger--tertiary"
                size="sm"
                onClick={handleClearAllDataCaches}
                renderIcon={TrashCan}
              >
                Clear All Data Caches
              </Button>
            </div>
          </Tile>
        </Column>
        {/* Reset Overrides */}
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <Reset size={20} />
              Reset Overrides
            </h2>

            <InlineNotification
              className="settings-page__warning-notice"
              kind="warning"
              title="Irreversible action"
              subtitle="Overrides include your manual VM exclusions, subnet edits, and custom profile configurations. Clearing them cannot be undone."
              lowContrast
              hideCloseButton
            />

            {resetNotification && (
              <InlineNotification
                kind="success"
                title={resetNotification}
                lowContrast
                onCloseButtonClick={() => setResetNotification(null)}
                style={{ marginTop: '0.5rem' }}
              />
            )}

            <div className="settings-page__cache-actions" style={{ marginTop: '1rem' }}>
              <Button
                kind="danger--tertiary"
                size="sm"
                onClick={handleResetVMOverrides}
              >
                Reset VM Overrides
              </Button>
              <Button
                kind="danger--tertiary"
                size="sm"
                onClick={handleResetSubnetOverrides}
              >
                Reset Subnet Overrides
              </Button>
              <Button
                kind="danger--tertiary"
                size="sm"
                onClick={handleResetProfileOverrides}
              >
                Reset Profile Overrides
              </Button>
              <Button
                kind="danger"
                size="sm"
                onClick={handleResetAllOverrides}
                renderIcon={TrashCan}
              >
                Reset All Overrides
              </Button>
            </div>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}

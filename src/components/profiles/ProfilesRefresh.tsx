// Profiles Refresh Component - Shows profiles status and refresh button

import { Button, Tag, InlineLoading } from '@carbon/react';
import { Renew, CloudOffline, Checkmark, Warning } from '@carbon/icons-react';
import type { ProfilesSource } from '@/services/profiles/profilesCache';
import './ProfilesRefresh.scss';

interface ProfilesRefreshProps {
  lastUpdated: Date | null;
  source: ProfilesSource;
  isRefreshing: boolean;
  onRefresh: () => void;
  isApiAvailable?: boolean | null;
  error?: string | null;
  compact?: boolean;
  profileCounts?: { vsi: number; bareMetal: number };
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSourceDisplay(source: ProfilesSource): { label: string; kind: 'blue' | 'green' | 'gray' } {
  switch (source) {
    case 'api':
      return { label: 'Live API', kind: 'green' };
    case 'proxy':
      return { label: 'Live Proxy', kind: 'green' };
    case 'cached':
      return { label: 'Cached', kind: 'blue' };
    case 'static':
    default:
      return { label: 'Static', kind: 'gray' };
  }
}

export function ProfilesRefresh({
  lastUpdated,
  source,
  isRefreshing,
  onRefresh,
  isApiAvailable,
  error,
  compact = false,
  profileCounts,
}: ProfilesRefreshProps) {
  const sourceDisplay = getSourceDisplay(source);

  if (compact) {
    const tooltipText = lastUpdated
      ? `Refresh profiles (last: ${formatLastUpdated(lastUpdated)})`
      : 'Refresh profiles';

    return (
      <div className="profiles-refresh profiles-refresh--compact">
        <Button
          kind="ghost"
          size="sm"
          renderIcon={isRefreshing ? undefined : Renew}
          onClick={onRefresh}
          disabled={isRefreshing}
          hasIconOnly
          iconDescription={tooltipText}
        >
          {isRefreshing && <InlineLoading description="" />}
        </Button>
        <Tag type={sourceDisplay.kind} size="sm">
          {sourceDisplay.label}
        </Tag>
      </div>
    );
  }

  return (
    <div className="profiles-refresh">
      <div className="profiles-refresh__status">
        <div className="profiles-refresh__source">
          {isApiAvailable === false ? (
            <CloudOffline size={16} className="profiles-refresh__icon profiles-refresh__icon--offline" />
          ) : source === 'api' || source === 'proxy' ? (
            <Checkmark size={16} className="profiles-refresh__icon profiles-refresh__icon--api" />
          ) : (
            <Warning size={16} className="profiles-refresh__icon profiles-refresh__icon--static" />
          )}
          <Tag type={sourceDisplay.kind} size="sm">
            {sourceDisplay.label}
          </Tag>
        </div>

        <span className="profiles-refresh__updated">
          {lastUpdated ? (
            <>Updated: {formatLastUpdated(lastUpdated)}</>
          ) : (
            <>Using bundled profile data</>
          )}
        </span>

        {profileCounts && (
          <span className="profiles-refresh__counts">
            {profileCounts.vsi} VSI, {profileCounts.bareMetal} Bare Metal
          </span>
        )}
      </div>

      <Button
        kind="ghost"
        size="sm"
        renderIcon={isRefreshing ? undefined : Renew}
        onClick={onRefresh}
        disabled={isRefreshing}
        className="profiles-refresh__button"
      >
        {isRefreshing ? (
          <InlineLoading description="Refreshing..." />
        ) : (
          'Refresh Profiles'
        )}
      </Button>

      {error && (
        <span className="profiles-refresh__error" title={error}>
          {error.includes('not_authorized') || error.includes('403')
            ? 'API key lacks VPC permissions'
            : error.includes('API key required')
              ? 'API key not configured'
              : 'API unavailable - using fallback data'}
        </span>
      )}
    </div>
  );
}

export default ProfilesRefresh;

// Remediation panel component for displaying step-by-step remediation guidance
import {
  Accordion,
  AccordionItem,
  Tag,
  UnorderedList,
  ListItem,
} from '@carbon/react';
import { Warning, ErrorFilled, InformationFilled } from '@carbon/icons-react';
import { RedHatDocLink } from './RedHatDocLink';
import './RemediationPanel.scss';

export type RemediationSeverity = 'blocker' | 'warning' | 'info';

export interface RemediationItem {
  id: string;
  name: string;
  severity: RemediationSeverity;
  description: string;
  remediation: string;
  documentationLink?: string;
  affectedCount: number;
  affectedVMs?: string[];
}

interface RemediationPanelProps {
  items: RemediationItem[];
  title?: string;
  showAffectedVMs?: boolean;
  maxVMsToShow?: number;
}

const severityConfig: Record<RemediationSeverity, {
  tagType: 'red' | 'magenta' | 'blue';
  icon: typeof ErrorFilled;
  label: string;
}> = {
  blocker: {
    tagType: 'red',
    icon: ErrorFilled,
    label: 'Blocker',
  },
  warning: {
    tagType: 'magenta',
    icon: Warning,
    label: 'Warning',
  },
  info: {
    tagType: 'blue',
    icon: InformationFilled,
    label: 'Info',
  },
};

export function RemediationPanel({
  items,
  title = 'Remediation Required',
  showAffectedVMs = false,
  maxVMsToShow = 5,
}: RemediationPanelProps) {
  if (items.length === 0) {
    return null;
  }

  // Sort by severity: blockers first, then warnings, then info
  const sortedItems = [...items].sort((a, b) => {
    const order: RemediationSeverity[] = ['blocker', 'warning', 'info'];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  const blockerCount = items.filter(i => i.severity === 'blocker').length;
  const warningCount = items.filter(i => i.severity === 'warning').length;

  return (
    <div className="remediation-panel">
      <div className="remediation-panel__header">
        <h3 className="remediation-panel__title">{title}</h3>
        <div className="remediation-panel__summary">
          {blockerCount > 0 && (
            <Tag type="red" size="sm">
              {blockerCount} {blockerCount === 1 ? 'Blocker' : 'Blockers'}
            </Tag>
          )}
          {warningCount > 0 && (
            <Tag type="magenta" size="sm">
              {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
            </Tag>
          )}
        </div>
      </div>

      <Accordion className="remediation-panel__accordion">
        {sortedItems.map((item) => {
          const config = severityConfig[item.severity];
          const Icon = config.icon;

          return (
            <AccordionItem
              key={item.id}
              title={
                <div className="remediation-panel__item-header">
                  <Icon
                    size={16}
                    className={`remediation-panel__icon remediation-panel__icon--${item.severity}`}
                  />
                  <span className="remediation-panel__item-name">{item.name}</span>
                  <Tag type={config.tagType} size="sm">
                    {item.affectedCount} {item.affectedCount === 1 ? 'VM' : 'VMs'}
                  </Tag>
                </div>
              }
              className={`remediation-panel__item remediation-panel__item--${item.severity}`}
            >
              <div className="remediation-panel__item-content">
                <p className="remediation-panel__description">{item.description}</p>

                <div className="remediation-panel__remediation">
                  <h4>Remediation Steps</h4>
                  <p>{item.remediation}</p>
                </div>

                {item.documentationLink && (
                  <div className="remediation-panel__docs">
                    <RedHatDocLink
                      href={item.documentationLink}
                      label="View Documentation"
                      description="Official documentation for this remediation"
                      size="sm"
                    />
                  </div>
                )}

                {showAffectedVMs && item.affectedVMs && item.affectedVMs.length > 0 && (
                  <div className="remediation-panel__vms">
                    <h4>Affected VMs</h4>
                    <UnorderedList>
                      {item.affectedVMs.slice(0, maxVMsToShow).map((vm) => (
                        <ListItem key={vm}>{vm}</ListItem>
                      ))}
                      {item.affectedVMs.length > maxVMsToShow && (
                        <ListItem>
                          ... and {item.affectedVMs.length - maxVMsToShow} more
                        </ListItem>
                      )}
                    </UnorderedList>
                  </div>
                )}
              </div>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

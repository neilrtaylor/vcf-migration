// About page with version info, changelog, and technology stack
import { Grid, Column, Tile, Accordion, AccordionItem, Tag, Link } from '@carbon/react';
import { LogoGithub, Launch, Document } from '@carbon/icons-react';
import changelogData from '@/data/changelog.json';
import './AboutPage.scss';

// Claude Code icon component (official Claude logo - abstract starburst)
function ClaudeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Claude Code"
    >
      <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
    </svg>
  );
}

// Type definition for changelog sections
interface ChangelogSections {
  added?: string[];
  changed?: string[];
  fixed?: string[];
  removed?: string[];
  deprecated?: string[];
  security?: string[];
}

interface ChangelogRelease {
  version: string;
  date: string;
  sections: ChangelogSections;
}

interface Changelog {
  releases: ChangelogRelease[];
}

const changelog = changelogData as Changelog;

// Technology stack information
const techStack = [
  { name: 'React', version: '19', description: 'UI framework' },
  { name: 'TypeScript', version: '5.9', description: 'Type-safe JavaScript' },
  { name: 'Vite', version: '7', description: 'Build tool and dev server' },
  { name: 'Carbon Design System', version: '11', description: 'IBM design system' },
  { name: 'Chart.js', version: '4', description: 'Data visualization' },
  { name: 'TanStack Table', version: '8', description: 'Data tables' },
  { name: 'SheetJS', version: '0.18', description: 'Excel file parsing' },
  { name: 'ExcelJS', version: '4', description: 'Excel file generation' },
  { name: 'jsPDF', version: '4', description: 'PDF generation' },
];

// Resource links
const resources = [
  {
    label: 'IBM Cloud VPC Documentation',
    href: 'https://cloud.ibm.com/docs/vpc',
    description: 'Virtual Private Cloud documentation',
  },
  {
    label: 'Red Hat OpenShift Documentation',
    href: 'https://docs.openshift.com',
    description: 'OpenShift Container Platform docs',
  },
  {
    label: 'OpenShift Virtualization',
    href: 'https://docs.openshift.com/container-platform/latest/virt/about_virt/about-virt.html',
    description: 'Run VMs on OpenShift',
  },
  {
    label: 'Migration Toolkit for Virtualization',
    href: 'https://docs.redhat.com/en/documentation/migration_toolkit_for_virtualization',
    description: 'VM migration to OpenShift',
  },
];

// Format date string for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format build time for display
function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function AboutPage() {
  return (
    <div className="about-page">
      <Grid>
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <h1 className="about-page__title">About</h1>
          <p className="about-page__subtitle">
            VMware Cloud Foundation Migration Planning Tool
          </p>
        </Column>

        {/* App Info */}
        <Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="about-page__tile">
            <h2 className="about-page__section-title">Application Info</h2>
            <div className="about-page__info-grid">
              <div className="about-page__info-item">
                <span className="about-page__info-label">Version</span>
                <span className="about-page__info-value">
                  <Tag type="blue" size="sm">{__APP_VERSION__}</Tag>
                </span>
              </div>
              <div className="about-page__info-item">
                <span className="about-page__info-label">Author</span>
                <span className="about-page__info-value">{__APP_AUTHOR__}</span>
              </div>
              <div className="about-page__info-item">
                <span className="about-page__info-label">License</span>
                <span className="about-page__info-value">
                  <Tag type="gray" size="sm">{__APP_LICENSE__}</Tag>
                </span>
              </div>
              <div className="about-page__info-item">
                <span className="about-page__info-label">Build Date</span>
                <span className="about-page__info-value">{formatBuildTime(__BUILD_TIME__)}</span>
              </div>
              <div className="about-page__info-item">
                <span className="about-page__info-label">Built with</span>
                <span className="about-page__info-value">
                  <Link
                    href="https://claude.ai/code"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-page__claude-link"
                  >
                    <ClaudeIcon size={16} />
                    <span>Claude Code</span>
                    <Launch size={12} />
                  </Link>
                </span>
              </div>
            </div>
            <p className="about-page__description">{__APP_DESCRIPTION__}</p>
          </Tile>
        </Column>

        {/* Technology Stack */}
        <Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="about-page__tile">
            <h2 className="about-page__section-title">Technology Stack</h2>
            <div className="about-page__tech-grid">
              {techStack.map((tech) => (
                <div key={tech.name} className="about-page__tech-item">
                  <div className="about-page__tech-name">
                    {tech.name}
                    <Tag type="outline" size="sm">{tech.version}</Tag>
                  </div>
                  <div className="about-page__tech-desc">{tech.description}</div>
                </div>
              ))}
            </div>
          </Tile>
        </Column>

        {/* Changelog */}
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="about-page__tile">
            <h2 className="about-page__section-title">Changelog</h2>
            <Accordion>
              {changelog.releases.map((release) => (
                <AccordionItem
                  key={release.version}
                  title={
                    <div className="about-page__release-header">
                      <Tag type="blue">v{release.version}</Tag>
                      <span className="about-page__release-date">{formatDate(release.date)}</span>
                    </div>
                  }
                >
                  <div className="about-page__release-content">
                    {release.sections.added && release.sections.added.length > 0 && (
                      <div className="about-page__release-section">
                        <h4>
                          <Tag type="green" size="sm">Added</Tag>
                        </h4>
                        <ul>
                          {release.sections.added.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {release.sections.changed && release.sections.changed.length > 0 && (
                      <div className="about-page__release-section">
                        <h4>
                          <Tag type="blue" size="sm">Changed</Tag>
                        </h4>
                        <ul>
                          {release.sections.changed.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {release.sections.fixed && release.sections.fixed.length > 0 && (
                      <div className="about-page__release-section">
                        <h4>
                          <Tag type="purple" size="sm">Fixed</Tag>
                        </h4>
                        <ul>
                          {release.sections.fixed.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {release.sections.removed && release.sections.removed.length > 0 && (
                      <div className="about-page__release-section">
                        <h4>
                          <Tag type="red" size="sm">Removed</Tag>
                        </h4>
                        <ul>
                          {release.sections.removed.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {release.sections.deprecated && release.sections.deprecated.length > 0 && (
                      <div className="about-page__release-section">
                        <h4>
                          <Tag type="magenta" size="sm">Deprecated</Tag>
                        </h4>
                        <ul>
                          {release.sections.deprecated.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {release.sections.security && release.sections.security.length > 0 && (
                      <div className="about-page__release-section">
                        <h4>
                          <Tag type="red" size="sm">Security</Tag>
                        </h4>
                        <ul>
                          {release.sections.security.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </Tile>
        </Column>

        {/* Resources */}
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="about-page__tile about-page__tile--resources">
            <h2 className="about-page__section-title">Resources</h2>
            <div className="about-page__resources-grid">
              {resources.map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-page__resource-link"
                >
                  <div className="about-page__resource-item">
                    <div className="about-page__resource-header">
                      <Document size={16} />
                      <span>{resource.label}</span>
                      <Launch size={12} />
                    </div>
                    <div className="about-page__resource-desc">{resource.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Tile>
        </Column>

        {/* Footer */}
        <Column lg={16} md={8} sm={4}>
          <div className="about-page__footer">
            <Link
              href="https://github.com/neilrtaylor/vcf-migration"
              target="_blank"
              rel="noopener noreferrer"
              className="about-page__github-link"
            >
              <LogoGithub size={20} />
              <span>View on GitHub</span>
            </Link>
          </div>
        </Column>
      </Grid>
    </div>
  );
}

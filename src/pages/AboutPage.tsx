// About page with version info, changelog, and technology stack
import { Grid, Column, Tile, Accordion, AccordionItem, Tag, Link } from '@carbon/react';
import { LogoGithub, Launch, Document } from '@carbon/icons-react';
import changelog from '@/data/changelog.json';
import './AboutPage.scss';

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
        <Column lg={16} md={8} sm={4}>
          <h1 className="about-page__title">About</h1>
          <p className="about-page__subtitle">
            VMware Cloud Foundation Migration Planning Tool
          </p>
        </Column>

        {/* App Info */}
        <Column lg={8} md={8} sm={4}>
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
            </div>
            <p className="about-page__description">{__APP_DESCRIPTION__}</p>
          </Tile>
        </Column>

        {/* Technology Stack */}
        <Column lg={8} md={8} sm={4}>
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
        <Column lg={16} md={8} sm={4}>
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
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </Tile>
        </Column>

        {/* Resources */}
        <Column lg={16} md={8} sm={4}>
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
              href="https://github.com"
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

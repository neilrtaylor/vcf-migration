// Reusable component for Red Hat/OpenShift documentation links
import { Link, Tooltip } from '@carbon/react';
import { Launch, Information } from '@carbon/icons-react';
import './RedHatDocLink.scss';

export interface RedHatDocLinkProps {
  href: string;
  label: string;
  description?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RedHatDocLink({
  href,
  label,
  description,
  iconOnly = false,
  size = 'md',
}: RedHatDocLinkProps) {
  const linkContent = (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`redhat-doc-link redhat-doc-link--${size}`}
      renderIcon={Launch}
    >
      {!iconOnly && label}
      {iconOnly && <Information size={size === 'sm' ? 16 : 20} />}
    </Link>
  );

  if (description) {
    return (
      <Tooltip
        align="bottom"
        label={description}
        className="redhat-doc-link__tooltip"
      >
        <span className="redhat-doc-link__wrapper">
          {linkContent}
        </span>
      </Tooltip>
    );
  }

  return linkContent;
}

// Grouped documentation links component
export interface DocLinkGroup {
  title: string;
  links: RedHatDocLinkProps[];
}

interface RedHatDocLinksGroupProps {
  title?: string;
  links: RedHatDocLinkProps[];
  layout?: 'vertical' | 'horizontal';
}

export function RedHatDocLinksGroup({
  title,
  links,
  layout = 'vertical',
}: RedHatDocLinksGroupProps) {
  return (
    <div className={`redhat-doc-links-group redhat-doc-links-group--${layout}`}>
      {title && <h4 className="redhat-doc-links-group__title">{title}</h4>}
      <div className="redhat-doc-links-group__links">
        {links.map((link, index) => (
          <RedHatDocLink key={index} {...link} />
        ))}
      </div>
    </div>
  );
}

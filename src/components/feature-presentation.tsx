import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn";
import "./medium-features.css";

export function FeatureHeader({ title, description, eyebrow, action, className }: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <header className={cn("feature-heading", className)}>
    <div>
      {eyebrow && <p className="feature-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="feature-heading-action">{action}</div>}
  </header>;
}

export function FeatureEmpty({ title, description, icon, action, className }: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return <section className={cn("feature-empty", className)} aria-labelledby={headingId}>
    {icon && <div className="feature-empty-icon" aria-hidden="true">{icon}</div>}
    <h2 id={headingId}>{title}</h2>
    {description && <p>{description}</p>}
    {action && <div className="feature-empty-action">{action}</div>}
  </section>;
}

export function FeatureSection({ title, description, action, children, className }: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return <section className={cn("feature-section", className)} aria-labelledby={title ? headingId : undefined}>
    {(title || description || action) && <header className="feature-section-heading">
      <div>
        {title && <h2 id={headingId}>{title}</h2>}
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>}
    {children}
  </section>;
}

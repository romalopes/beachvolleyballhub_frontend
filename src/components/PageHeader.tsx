import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  // Pages that pass actions (buttons, badges) get a two-column header: the copy
  // stays readable on the left, while the actions align to the top-right and
  // wrap underneath on narrow screens.
  return (
    <div className={`page-header${children ? ' page-header--with-actions' : ''}`}>
      <div className="page-header-copy">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}


import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface LibraryHeroHighlight {
  icon: LucideIcon;
  label: string;
}

interface LibraryHeroProps {
  /** Small uppercase kicker above the title ("Coaching workspace"). */
  eyebrow: string;
  title: string;
  description: string;
  /** Short capability chips rendered under the description. */
  highlights: LibraryHeroHighlight[];
  /** Accessible name for the highlight group. */
  highlightsLabel: string;
  /**
   * Accent modifier class (`library-hero--groups`, …) selecting the section's
   * colour palette; omit for the default warm sand.
   */
  theme?: string;
  /** Primary CTA rendered top-right; the caller styles it (`btn-primary`). */
  action?: ReactNode;
}

/**
 * Shared library hero, the same anatomy as the analysis and organisation
 * library headers: eyebrow, title, description, capability chips, and a
 * primary action on the right. Theming is done through the `--hero-*`
 * custom properties set by the modifier class in App.css.
 */
export default function LibraryHero({
  eyebrow,
  title,
  description,
  highlights,
  highlightsLabel,
  theme,
  action,
}: LibraryHeroProps) {
  return (
    <header className={theme ? `library-hero ${theme}` : "library-hero"}>
      <div className="library-hero-copy">
        <span className="analysis-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="library-hero-highlights" aria-label={highlightsLabel}>
          {highlights.map(({ icon: Icon, label }) => (
            <span key={label}>
              <Icon size={14} aria-hidden="true" /> {label}
            </span>
          ))}
        </div>
      </div>
      {action && <div className="library-hero-action">{action}</div>}
    </header>
  );
}

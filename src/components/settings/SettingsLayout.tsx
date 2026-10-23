import type { ReactNode } from "react";
import PageHeader from "../PageHeader";
import BackLink from "./BackLink";
import LibraryHero, {
  type LibraryHeroHighlight,
} from "../LibraryHero";

/** Describes the shared library hero shown instead of the plain header. */
export interface SettingsHero {
  /** Small uppercase kicker above the title ("Data management"). */
  eyebrow: string;
  /** Short capability chips rendered under the description. */
  highlights: LibraryHeroHighlight[];
  /** Accessible name for the highlight group. */
  highlightsLabel: string;
  /** Accent modifier class selecting the palette (`library-hero--settings`). */
  theme?: string;
  /** Overrides the layout description when the hero needs different wording. */
  description?: string;
}

interface SettingsLayoutProps {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  /** Fallback destination for the general back link when no explicit backTo is given. */
  backFallback?: string;
  actions?: ReactNode;
  /**
   * Replaces the plain page header with the shared library hero. The hero
   * reuses `title` and `description`, and renders `actions` as its primary
   * call to action.
   */
  hero?: SettingsHero;
  children: ReactNode;
}

export default function SettingsLayout({
  title,
  description,
  backTo,
  backLabel,
  backFallback,
  actions,
  hero,
  children,
}: SettingsLayoutProps) {
  const showBack = backTo || backLabel || backFallback;

  return (
    <div className="page">
      {showBack && (
        <BackLink to={backTo} label={backLabel} fallback={backFallback ?? "/settings"} />
      )}
      {hero ? (
        <LibraryHero
          eyebrow={hero.eyebrow}
          title={title}
          description={hero.description ?? description ?? ""}
          highlights={hero.highlights}
          highlightsLabel={hero.highlightsLabel}
          theme={hero.theme}
          action={actions}
        />
      ) : (
        <PageHeader title={title} description={description}>
          {actions}
        </PageHeader>
      )}
      {children}
    </div>
  );
}

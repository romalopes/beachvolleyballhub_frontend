import type { AssessmentSessionVisibility } from "../../api";

interface VisibilityBadgeProps {
  visibility: AssessmentSessionVisibility;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const visibilityConfig: Record<AssessmentSessionVisibility, { label: string; color: string; bgColor: string }> = {
  public: {
    label: "Public",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  unlisted: {
    label: "Unlisted",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  internal: {
    label: "Internal",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  private: {
    label: "Private",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

export function VisibilityBadge({
  visibility,
  size = "md",
  showLabel = true,
}: VisibilityBadgeProps) {
  const config = visibilityConfig[visibility];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${config.bgColor} ${config.color}`}
      title={config.label}
    >
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function VisibilityIcon({ visibility }: { visibility: AssessmentSessionVisibility }) {
  const config = visibilityConfig[visibility];
  if (!config) return null;

  switch (visibility) {
    case "public":
      return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case "unlisted":
      return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>;
    case "internal":
      return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    case "private":
      return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>;
  }
}
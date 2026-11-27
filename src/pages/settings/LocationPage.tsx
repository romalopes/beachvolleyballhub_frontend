import LocationCreatePage from "./LocationCreatePage";
import LocationEditPage from "./LocationEditPage";

export type LocationPageMode = "create" | "edit";

interface LocationPageProps {
  mode: LocationPageMode;
}

/**
 * Compatibility wrapper kept for call sites that still pick the venue screen
 * by mode. The create and edit flows now live in their own routed pages, so
 * this simply delegates and shares their hero + workbench layout.
 */
export default function LocationPage({ mode }: LocationPageProps) {
  return mode === "create" ? <LocationCreatePage /> : <LocationEditPage />;
}

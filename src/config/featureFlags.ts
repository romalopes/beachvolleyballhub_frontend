function envFlag(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

export const featureFlags = {
  mobileLayoutEnabled: envFlag(import.meta.env.VITE_MOBILE_LAYOUT_ENABLED),
  pwaEnabled: envFlag(import.meta.env.VITE_PWA_ENABLED),
  offlineEnabled: envFlag(import.meta.env.VITE_OFFLINE_ENABLED),
} as const;

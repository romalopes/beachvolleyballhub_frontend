import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import * as Sentry from "@sentry/react";
import SentryFallback from "./components/SentryFallback";
import { registerSW } from "virtual:pwa-register";
import { featureFlags } from "./config/featureFlags";
import { initializeCapacitor } from "./services/capacitor";

if (featureFlags.pwaEnabled) {
  const updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("bvb-offline-ready"));
    },
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent("bvb-update-available"));
    },
    onRegistered(r) {
      console.log("SW Registered:", r);
    },
    onRegisterError(error) {
      console.error("SW Registration Error:", error);
    },
  });

  void updateServiceWorker;

  // Handle PWA update banner
  window.addEventListener("bvb-update-available", () => {
    const banner = document.createElement("div");
    banner.className = "pwa-update-banner";
    banner.innerHTML = `
      <div class="pwa-update-banner__content">
        <div class="pwa-update-banner__text">
          <div class="pwa-update-banner__title">Update Available</div>
          <div class="pwa-update-banner__message">A new version of Beach Volleyball Hub is ready.</div>
        </div>
        <div class="pwa-update-banner__actions">
          <button type="button" class="pwa-update-banner__btn pwa-update-banner__btn--secondary" id="pwa-update-later">Later</button>
          <button type="button" class="pwa-update-banner__btn pwa-update-banner__btn--primary" id="pwa-update-now">Refresh Now</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelector("#pwa-update-now")?.addEventListener("click", () => {
      updateServiceWorker().then(() => {
        window.location.reload();
      });
    });

    banner.querySelector("#pwa-update-later")?.addEventListener("click", () => {
      banner.remove();
    });
  });

  // Handle offline ready
  window.addEventListener("bvb-offline-ready", () => {
    console.log("App ready for offline use");
    // Could show a toast notification here
  });
}

// Initialize Capacitor
initializeCapacitor();

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <SentryFallback error={error} resetError={resetError} />
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);

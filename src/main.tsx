import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import * as Sentry from "@sentry/react";
import SentryFallback from "./components/SentryFallback";

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(), // Captures video-like session replays for crashes
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1, // 10% of standard sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);

import { useEffect } from "react";
import * as Sentry from "@sentry/react";

type SentryFallbackProps = {
  /** The error caught by `<Sentry.ErrorBoundary>` (typed `unknown` by Sentry). */
  error?: unknown;
  /** Resets the boundary so the tree can render again. */
  resetError?: () => void;
};

/**
 * Normalises whatever the error boundary caught into displayable strings.
 * Sentry types the caught value as `unknown`, so it may not be an `Error`.
 */
function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error === null || error === undefined) {
    return { message: "" };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * Fallback rendered by `<Sentry.ErrorBoundary>` when a render error escapes.
 *
 * The boundary already reports the error to Sentry, so this component only
 * presents it and attaches the current route to the scope for filtering.
 * It deliberately does not use `useRouteError()`: this renders *instead of*
 * `<App />`, i.e. outside the router, where that hook would throw.
 */
export default function SentryFallback({ error, resetError }: SentryFallbackProps) {
  const { message, stack } = describeError(error);

  // Add route context to the Sentry scope for better filtering.
  useEffect(() => {
    if (!error) return;

    const scope = Sentry.getCurrentScope();
    scope?.setTag("route", window.location.pathname);
  }, [error]);

  const handleRetry = () => {
    if (resetError) {
      resetError();
      return;
    }

    window.location.reload();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Something went wrong</h1>
      {message && (
        <div style={styles.errorDetails}>
          <h2>Error:</h2>
          <pre style={styles.errorText}>{message}</pre>
          {/* Show stack trace only in development */}
          {import.meta.env.DEV && stack && (
            <>
              <div style={styles.stackLabel}>Stack Trace:</div>
              <pre style={styles.stackText}>{stack}</pre>
            </>
          )}
        </div>
      )}
      <button onClick={handleRetry} style={styles.button}>
        Try Again
      </button>
    </div>
  );
}

const styles = {
  container: {
    padding: "2rem",
    textAlign: "center" as const,
    fontFamily: "system-ui, sans-serif",
  },
  title: {
    color: "#dc3545",
    marginBottom: "1.5rem",
  },
  errorDetails: {
    textAlign: "left" as const,
    maxWidth: "600px",
    margin: "0 auto 2rem",
  },
  errorText: {
    backgroundColor: "#f8f9fa",
    padding: "1rem",
    borderRadius: "4px",
    overflowX: "auto" as const,
  },
  stackLabel: {
    marginTop: "1rem",
    fontWeight: "bold",
    color: "#6c757d",
  },
  stackText: {
    backgroundColor: "#e9ecef",
    padding: "1rem",
    borderRadius: "4px",
    overflowX: "auto" as const,
    fontSize: "0.9rem",
  },
  button: {
    backgroundColor: "#0d6efd",
    color: "white",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1rem",
  },
};

import { RefreshCw, Wifi, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OfflinePage() {
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Auto-retry when coming back online
    const handleOnline = () => {
      setRetrying(true);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <div className="offline-page">
      <div className="offline-page__icon">
        <AlertTriangle size={64} aria-hidden="true" />
      </div>
      <h1 className="offline-page__title">You're Offline</h1>
      <p className="offline-page__message">
        No internet connection detected. Please check your connection and try again.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          className="offline-page__retry"
          onClick={handleRetry}
          disabled={retrying}
          aria-busy={retrying}
        >
          {retrying ? (
            <>
              <RefreshCw size={18} className="offline-page__spinner" aria-hidden="true" />
              Reloading...
            </>
          ) : (
            <>
              <RefreshCw size={18} aria-hidden="true" />
              Try Again
            </>
          )}
        </button>
        <button
          className="offline-page__retry"
          style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
          onClick={handleGoHome}
        >
          <Wifi size={18} aria-hidden="true" />
          Go to Home
        </button>
      </div>

      <div className="offline-page__cached-data">
        <h3 className="offline-page__cached-title">Available Offline</h3>
        <p className="offline-page__cached-item">• Previously loaded weather shares</p>
        <p className="offline-page__cached-item">• Cached tournament data</p>
        <p className="offline-page__cached-item">• Your training templates</p>
        <p className="offline-page__cached-item">• Offline-compatible pages</p>
      </div>
    </div>
  );
}
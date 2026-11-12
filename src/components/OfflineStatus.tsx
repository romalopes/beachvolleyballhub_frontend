import { Cloud, CloudOff, RefreshCw, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { currentUserScope } from "../offline/db";
import { pendingOfflineOperationCount, syncPendingOperations } from "../offline/sync";
import { sendOfflineOperation } from "../offline/transport";
import { useAuth } from "../auth/AuthContext";
import { featureFlags } from "../config/featureFlags";

export default function OfflineStatus() {
  const { user } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  const scope = currentUserScope(user?.id);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const count = await pendingOfflineOperationCount(scope);
      if (active) setPending(count);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [scope]);

  const sync = async () => {
    await syncPendingOperations(scope, sendOfflineOperation);
    setPending(await pendingOfflineOperationCount(scope));
  };

  if (!featureFlags.offlineEnabled) return null;

  return (
    <div className={`offline-status ${online ? "offline-status--online" : "offline-status--offline"}`} role="status">
      {online ? <Cloud size={15} aria-hidden="true" /> : <CloudOff size={15} aria-hidden="true" />}
      <span>{online ? "Online" : "Offline"}</span>
      {pending > 0 && (
        <button type="button" className="offline-status-sync" onClick={() => void sync()} aria-label={`Sync ${pending} pending changes`}>
          <RefreshCw size={14} aria-hidden="true" /> {pending} pending
        </button>
      )}
    </div>
  );
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!featureFlags.pwaEnabled) return;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after user has interacted with the app for a bit
      setTimeout(() => setShowPrompt(true), 10000);
    };

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log("PWA was installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Also check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                         (window.navigator as any).standalone === true;
    if (isStandalone) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for a while
    localStorage.setItem("installPromptDismissed", Date.now().toString());
  };

  // Don't show if already dismissed recently (7 days)
  const dismissed = localStorage.getItem("installPromptDismissed");
  if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) {
    return null;
  }

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install Beach Volleyball Hub">
      <div className="install-prompt__content">
        <div className="install-prompt__icon">
          <Download size={32} aria-hidden="true" />
        </div>
        <div className="install-prompt__text">
          <h3>Install Beach Volleyball Hub</h3>
          <p>Add to home screen for offline access and faster loading</p>
        </div>
      </div>
      <div className="install-prompt__actions">
        <button type="button" className="install-prompt__btn install-prompt__btn--secondary" onClick={handleDismiss}>
          <X size={16} aria-hidden="true" /> Not Now
        </button>
        <button type="button" className="install-prompt__btn install-prompt__btn--primary" onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>
  );
}

// Type declaration for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}
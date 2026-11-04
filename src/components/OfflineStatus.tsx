import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { currentUserScope } from "../offline/db";
import { pendingOfflineOperationCount, syncPendingOperations } from "../offline/sync";
import { sendOfflineOperation } from "../offline/transport";
import { useAuth } from "../auth/AuthContext";

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
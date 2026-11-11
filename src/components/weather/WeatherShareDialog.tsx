import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, Download, Copy, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../api";
import type { WeatherShareCreateResponse, WeatherShareMetadata } from "../../api";


interface WeatherShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  locationName: string;
  forecastTargetTime?: string | null;
}

interface ShareDialogState {
  status: "idle" | "creating" | "preview" | "error";
  shareData?: WeatherShareCreateResponse;
  metadata?: WeatherShareMetadata;
  error?: string;
}

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "Current";
  try {
    return new Date(isoString).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function severityClass(label: string): string {
  return `weather-advisor--${label.toLowerCase().replace(/\\s+/g, "-")}`;
}

function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.canShare &&
    navigator.canShare({ files: [] })
  );
}

export function WeatherShareDialog({
  isOpen,
  onClose,
  latitude,
  longitude,
  locationName,
  forecastTargetTime,
}: WeatherShareDialogProps) {
  const toast = (opts: { title: string; description: string; variant?: string }) => console.log(`[${opts.variant || "info"}] ${opts.title}: ${opts.description}`);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<ShareDialogState>({ status: "idle" });
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setState({ status: "idle" });
      setCopiedUrl(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
      createShare();
    } else if (!isOpen && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const createShare = useCallback(async () => {
    setState({ status: "creating" });

    try {
      const response = await api.weatherShare.create({
        lat: latitude,
        lon: longitude,
        location_name: locationName,
        forecast_target_time: forecastTargetTime || undefined,
      });

      const metadata = await api.weatherShare.metadata(response.public_token);

      setState({ status: "preview", shareData: response, metadata });
      pollForImage(response.public_token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create share";
      setState({ status: "error", error: message });
      console.error(`Share failed: ${message}`);
    }
  }, [latitude, longitude, locationName, forecastTargetTime, toast]);

  const pollForImage = useCallback(async (publicToken: string) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const metadata = await api.weatherShare.metadata(publicToken);

        if (metadata.image_url) {
          setState((prev) => ({
            ...prev,
            metadata: { ...prev.metadata, ...metadata },
          }));
          return;
        }
      } catch (error) {
        console.warn("Polling for image failed:", error);
      }
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!state.shareData) return;

    try {
      await navigator.clipboard.writeText(state.shareData.public_url);
      setCopiedUrl(true);
      console.log("Link copied: Share URL copied to clipboard");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      console.error("Copy failed: Could not copy to clipboard");
    }
  }, [state.shareData, toast]);

  const handleDownloadImage = useCallback(async () => {
    if (!state.metadata?.image_url) return;

    setDownloading(true);
    try {
      const response = await fetch(state.metadata.image_url);
      if (!response.ok) {
        throw new Error(`Image request failed with ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weather-share-${state.shareData?.public_token}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Image downloaded: Weather share image saved to your device");
    } catch {
      // Cross-origin image hosts may block fetch/blob access without CORS.
      // Opening the public image URL still lets the browser display or save it.
      window.open(state.metadata.image_url, "_blank", "noopener,noreferrer");
      console.warn("Direct download unavailable; opened image URL instead");
    } finally {
      setDownloading(false);
    }
  }, [state.metadata, state.shareData, toast]);

  const handleShareLink = useCallback(async () => {
    if (!state.shareData) return;

    setSharing(true);
    try {
      const shareData = {
        title: `Beach Volleyball Weather at ${state.metadata?.location_name}`,
        text: `Check out the beach volleyball conditions at ${state.metadata?.location_name}`,
        url: state.shareData.public_url,
      };

      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        console.log("Shared: Weather share sent successfully");
      } else {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
          `${shareData.text}\n${shareData.url}`,
        )}`;
        window.open(whatsappUrl, "_blank");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Share failed: Could not share link");
    } finally {
      setSharing(false);
    }
  }, [state.shareData, state.metadata, toast]);

  const handleShareImage = useCallback(async () => {
    if (!state.metadata?.image_url || !state.shareData) return;

    setSharing(true);
    try {
      if (canShareFiles()) {
        const response = await fetch(state.metadata.image_url);
        if (!response.ok) {
          throw new Error(`Image request failed with ${response.status}`);
        }

        const blob = await response.blob();
        const file = new File([blob], `weather-share-${state.shareData.public_token}.png`, {
          type: "image/png",
        });
        const shareData = {
          title: `Beach Volleyball Weather at ${state.metadata.location_name}`,
          text: `Beach volleyball conditions at ${state.metadata.location_name}`,
          files: [file],
        };

        await navigator.share(shareData);
        console.log("Shared: Weather image sent successfully");
      } else {
        // Desktop browsers commonly do not support sharing files. Share the
        // public report URL instead so the recipient can view the image.
        const shareData = {
          title: `Beach Volleyball Weather at ${state.metadata.location_name}`,
          text: `Beach volleyball conditions at ${state.metadata.location_name}`,
          url: state.shareData.public_url,
        };

        if (navigator.share && navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
        } else {
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
            `${shareData.text}\n${shareData.url}`,
          )}`;
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Share failed: Could not share image", error);
      toast({
        title: "Share failed",
        description: "Could not share the image",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  }, [state.metadata, state.shareData, toast]);

  const handleRetry = useCallback(() => {
    createShare();
  }, [createShare]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} className="weather-share-dialog" onClose={onClose}>
      <div className="weather-share-dialog__header">
        <h2>Share Weather</h2>
        <button className="weather-share-dialog__close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {state.status === "creating" && (
        <div className="weather-share-dialog__loading">
          <Loader2 className="weather-share-dialog__spinner" size={32} />
          <p>Generating weather share...</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="weather-share-dialog__error">
          <AlertCircle size={32} className="weather-share-dialog__error-icon" />
          <p>{state.error}</p>
          <button className="weather-share-dialog__retry" onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}

      {state.status === "preview" && state.shareData && state.metadata && (
        <div className="weather-share-dialog__preview">
          <div className="weather-share-dialog__card">
            <div className="weather-share-dialog__card-header">
              <div className="weather-share-dialog__card-brand">
                <img src="/ball.png" className="weather-share-dialog__logo" width="48" height="48" aria-hidden="true" />
                <span>BeachVolleyballHub</span>
              </div>
              <span className="weather-share-dialog__card-time">
                Forecast for {formatTime(state.metadata.forecast_target_time)}
              </span>
            </div>

            <div className="weather-share-dialog__card-location">
              <span aria-hidden="true">📍</span>
              <span>{state.metadata.location_name}</span>
            </div>

            {state.metadata.image_url && (
              <div className="weather-share-dialog__card-image">
                <img
                  src={state.metadata.image_url}
                  alt={`Weather share for ${state.metadata.location_name}`}
                  width="100%"
                  height="auto"
                />
              </div>
            )}

            <div className={`weather-share-dialog__card-advisor ${severityClass(state.metadata.volleyball.label)}`}>
              <div className="weather-share-dialog__card-score">
                <span className="weather-share-dialog__card-label">{state.metadata.volleyball.label}</span>
                <span className="weather-share-dialog__card-value">
                  {state.metadata.volleyball.score === null
                    ? "No data"
                    : `${state.metadata.volleyball.score}/100`}
                </span>
              </div>
              {state.metadata.volleyball.warnings.length > 0 && (
                <div className="weather-share-dialog__card-warnings">
                  {state.metadata.volleyball.warnings.map((w, i) => (
                    <p key={i} role="alert">⚠️ {w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="weather-share-dialog__actions">
            <button
              className="weather-share-dialog__action-btn weather-share-dialog__action-btn--primary"
              onClick={handleShareLink}
              disabled={sharing}
            >
              <Share2 size={18} />
              {sharing ? "Sharing..." : "Share Link"}
            </button>

            <button
              className="weather-share-dialog__action-btn"
              onClick={handleShareImage}
              disabled={sharing || !state.metadata?.image_url}
            >
              <Share2 size={18} />
              Share Image
            </button>

            <button
              className="weather-share-dialog__action-btn"
              onClick={handleCopyLink}
              disabled={copiedUrl}
            >
              {copiedUrl ? (
                <>
                  <Check size={18} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Copy Link
                </>
              )}
            </button>

            <button
              className="weather-share-dialog__action-btn"
              onClick={handleDownloadImage}
              disabled={downloading || !state.metadata.image_url}
            >
              {downloading ? (
                <>
                  <Loader2 size={18} className="weather-share-dialog__spinner" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Download Image
                </>
              )}
            </button>
          </div>

          <p className="weather-share-dialog__url">
            <span>Share URL:</span>
            <code>{state.shareData.public_url}</code>
          </p>
        </div>
      )}
    </dialog>
  );
}

export default WeatherShareDialog;

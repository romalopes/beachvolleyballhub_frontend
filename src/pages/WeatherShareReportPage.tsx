import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AlertCircle, Loader2, ArrowLeft, Share2, Download, Copy, Check, MapPin, ChevronRight } from "lucide-react";
import { api } from "../api";
import type { WeatherShareMetadata } from "../api";
import { WeatherShareCard } from "../components/weather/WeatherShareCard";




export default function WeatherShareReportPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  
  
  
  const [state, setState] = useState<{
    status: "loading" | "success" | "error";
    data?: WeatherShareMetadata;
    error?: string;
  }>({ status: "loading" });
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing] = useState(false);
  

  useEffect(() => {
    if (!publicToken) {
      setState({ status: "error", error: "Invalid share link" });
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const data = await api.weatherShare.metadata(publicToken);
        if (!cancelled) {
          setState({ status: "success", data });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", error: error instanceof Error ? error.message : "Failed to load share" });
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [publicToken]);

  if (state.status === "loading") {
    return (
      <div className="weather-share-report loading">
        <div className="weather-share-report__spinner">
          <Loader2 size={48} className="weather-share-report__loader" />
          <p>Loading weather share...</p>
        </div>
      </div>
    );
  }

  if (state.status === "error" || !state.data) {
    return (
      <div className="weather-share-report error">
        <div className="weather-share-report__error">
          <AlertCircle size={64} className="weather-share-report__error-icon" />
          <h1>Share Unavailable</h1>
          <p>{state.error || "This weather share could not be loaded."}</p>
          <Link to="/" className="weather-share-report__home-link">
            <ArrowLeft size={18} />
            Go to BeachVolleyballHub
          </Link>
        </div>
      </div>
    );
  }

  const { 
    location_name, 
    forecast_target_time, 
    timezone, 
    volleyball, 
    image_url, 
    canonical_url 
  } = state.data;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonical_url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      console.error("Copy failed");
    }
  };

  const handleDownloadImage = async () => {
    if (!image_url) return;
    setDownloading(true);
    try {
      const response = await fetch(image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weather-share-${publicToken}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      console.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShareLink = async () => {
    const shareData = {
      title: `Beach Volleyball Weather at ${location_name}`,
      text: `Check out the beach volleyball conditions at ${location_name}`,
      url: canonical_url,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Share failed:", error);
        }
      }
    } else {
      await navigator.clipboard.writeText(canonical_url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleShareImage = async () => {
    if (!image_url) return;

    if (navigator.canShare && navigator.canShare({ files: [] })) {
      try {
        const response = await fetch(image_url);
        const blob = await response.blob();
        const file = new File([blob], `weather-share-${publicToken}.png`, { type: "image/png" });

        const shareData = {
          title: `Beach Volleyball Weather at ${location_name}`,
          text: `Beach volleyball conditions at ${location_name}`,
          files: [file],
        };

        if (navigator.share && navigator.canShare(shareData)) {
          await navigator.share(shareData);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Share failed:", error);
        }
      }
    }
  };

  return (
    <div className="weather-share-report">
      <header className="weather-share-report__header">
        <Link to="/" className="weather-share-report__back">
          <ArrowLeft size={20} />
          <span>Back to Hub</span>
        </Link>
        <div className="weather-share-report__actions">
          <button
            className="weather-share-report__action-btn"
            onClick={handleShareLink}
            disabled={sharing}
          >
            <Share2 size={18} />
            {sharing ? "Sharing..." : "Share Link"}
          </button>
          <button
            className="weather-share-report__action-btn"
            onClick={handleShareImage}
            disabled={sharing || !image_url}
          >
            <Share2 size={18} />
            Share Image
          </button>
          <button
            className="weather-share-report__action-btn"
            onClick={handleCopyLink}
            disabled={copiedUrl}
          >
            {copiedUrl ? (
              <> <Check size={18} /> Copied! </>
            ) : (
              <> <Copy size={18} /> Copy Link </>
            )}
          </button>
          <button
            className="weather-share-report__action-btn"
            onClick={handleDownloadImage}
            disabled={downloading || !image_url}
          >
            {downloading ? (
              <> <Loader2 size={18} className="weather-share-report__spinner" /> Downloading... </>
            ) : (
              <> <Download size={18} /> Download Image </>
            )}
          </button>
        </div>
      </header>

      <main className="weather-share-report__main">
        <WeatherShareCard snapshot={{
          location_name,
          forecast_target_time,
          timezone,
          current: (state.data.current ?? {}) as any,
          forecast: state.data.forecast ?? [],
          volleyball,
          public_url: canonical_url,
        }} />

        <div className="weather-share-report__extra">
          <div className="weather-share-report__location-link">
            <MapPin size={20} />
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${state.data.latitude},${state.data.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="weather-share-report__maps-link"
            >
              <span>Open in Google Maps</span>
              <ChevronRight size={16} />
            </a>
          </div>
          <p className="weather-share-report__disclaimer">
            This is a snapshot of conditions at share time. Actual conditions may vary.
            Not an official safety rating. Always check official warnings before playing.
          </p>
        </div>
      </main>
    </div>
  );
}

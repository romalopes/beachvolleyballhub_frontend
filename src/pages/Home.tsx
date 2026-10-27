import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Category, type Skill, type Drill } from "../api";
import {
  ArrowRight,
  Target,
  Dumbbell,
  PlayCircle,
  ClipboardList,
  CalendarDays,
  MapPin,
} from "lucide-react";
import LocationMap from "../components/locations/LocationMap";

interface IpLocation {
  status: string;
  lat?: number;
  lon?: number;
  city?: string;
  country?: string;
  message?: string;
}

interface DetectedLocation {
  lat: number;
  lon: number;
  city: string | null;
  country: string | null;
  source: "browser" | "ip";
}

const FALLBACK_VENUE: DetectedLocation = {
  lat: -33.919655,
  lon: 151.258574,
  city: null,
  country: null,
  source: "ip",
};

const sections = [
  {
    title: "Skills",
    path: "/skills",
    icon: Target,
    description:
      "Browse all beach volleyball skills organised by category. Each skill includes descriptions and related drills.",
  },
  {
    title: "Drills",
    path: "/drills",
    icon: Dumbbell,
    description:
      "Search and filter drills by difficulty, training stage, and player range. Each drill links to the skills it develops.",
  },
  {
    title: "Videos",
    path: "/videos",
    icon: PlayCircle,
    description:
      "Watch skill demonstrations, drill walkthroughs, and training footage from the video library.",
  },
  {
    title: "Training",
    path: "/training",
    icon: ClipboardList,
    description:
      "View training sessions that combine multiple drills and skills into structured practice plans.",
  },
  {
    title: "Schedule",
    path: "/schedule",
    icon: CalendarDays,
    description:
      "See upcoming training sessions and plan your practice calendar.",
  },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [detectedLocation, setDetectedLocation] =
    useState<DetectedLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.categories(), api.skills(), api.drills()])
      .then(([cats, sks, drs]) => {
        setCategories(cats);
        setSkills(sks);
        setDrills(drs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const detectBrowserLocation = (): Promise<DetectedLocation> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser."));
          return;
        }
        const timeoutId = setTimeout(() => {
          reject(new Error("Location request timed out."));
        }, 10000);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              city: null,
              country: null,
              source: "browser",
            });
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      });
    };

    const detectIpLocation = (): Promise<DetectedLocation> => {
      return fetch("https://extreme-ip-lookup.com/json/")
        .then((response) => response.json())
        .then((data: IpLocation) => {
          if (
            data.status === "success" &&
            data.lat != null &&
            data.lon != null
          ) {
            return {
              lat: data.lat,
              lon: data.lon,
              city: data.city ?? null,
              country: data.country ?? null,
              source: "ip",
            };
          }
          throw new Error(
            data.message ??
              "IP location lookup returned no usable coordinates.",
          );
        });
    };

    const runDetection = async () => {
      try {
        const loc = await detectBrowserLocation();
        if (!cancelled) {
          setDetectedLocation(loc);
        }
      } catch (browserError) {
        console.warn("Browser geolocation failed:", browserError);
        try {
          const loc = await detectIpLocation();
          if (!cancelled) {
            setDetectedLocation(loc);
          }
        } catch (ipError) {
          if (!cancelled) {
            setLocationError(
              ipError instanceof Error
                ? ipError.message
                : "Unable to detect your location.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLocationLoading(false);
        }
      }
    };

    runDetection();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const venue = detectedLocation ?? FALLBACK_VENUE;

  return (
    <div className="page">
      <section className="home-hero">
        <div className="home-hero-badge">
          <Target size={14} />
          Beach Volleyball Knowledge System
        </div>
        <h1>BEACH VOLLEYBALL HUB</h1>
        <p className="home-hero-tagline">
          Organise the skills. Understand the game. Train with purpose.
        </p>
      </section>
      <section className="home-location">
        <div className="home-location-content">
          <div className="home-location-header">
            <MapPin size={20} aria-hidden="true" />
            <h2>{detectedLocation ? "Near You" : "Featured Venue"}</h2>
          </div>
          {locationLoading && (
            <p className="home-location-loading">Detecting your location…</p>
          )}
          {locationError && !detectedLocation && (
            <p className="home-location-error">
              {locationError} Showing featured venue.
            </p>
          )}
          <p className="home-location-text">
            {detectedLocation?.source === "ip" && detectedLocation.city
              ? `Train near ${detectedLocation.city}, ${detectedLocation.country}.`
              : detectedLocation?.source === "browser"
                ? `Your current location (${venue.lat.toFixed(4)}, ${venue.lon.toFixed(4)}).`
                : "Train at Coogee Beach, one of Sydney’s iconic beach volleyball spots."}
          </p>
          <LocationMap
            name={
              detectedLocation?.city
                ? `${detectedLocation.city}, ${detectedLocation.country}`
                : venue.lat === FALLBACK_VENUE.lat &&
                    venue.lon === FALLBACK_VENUE.lon
                  ? "Coogee Beach"
                  : "Your location"
            }
            latitude={venue.lat}
            longitude={venue.lon}
            externalUrl={null}
            query={
              detectedLocation?.city
                ? `${detectedLocation.city}, ${detectedLocation.country}`
                : venue.lat === FALLBACK_VENUE.lat &&
                    venue.lon === FALLBACK_VENUE.lon
                  ? "Coogee Beach, Sydney, NSW, Australia"
                  : `${venue.lat},${venue.lon}`
            }
          />
        </div>
      </section>
      <section className="home-stats">
        <div className="home-stat">
          <span className="home-stat-value">{categories.length}</span>
          <span className="home-stat-label">Categories</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-value">{skills.length}</span>
          <span className="home-stat-label">Skills</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-value">{drills.length}</span>
          <span className="home-stat-label">Drills</span>
        </div>
      </section>

      <section className="home-sections">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.path}
              to={section.path}
              className="home-section-card"
            >
              <div className="home-section-card-header">
                <Icon className="home-section-card-icon" size={20} />
                <h3>{section.title}</h3>
              </div>
              <p>{section.description}</p>
              <span className="home-section-link">
                Explore {section.title} <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Category,
  type Drill,
  type Skill,
  type WeatherResponse,
} from "../api";
import {
  ArrowRight,
  Target,
  Dumbbell,
  PlayCircle,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import HomeLocationPanel from "../components/locations/HomeLocationPanel";
import WeatherWidget from "../components/weather/WeatherWidget";

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

type WeatherRequest =
  | { key: string; status: "success"; data: WeatherResponse }
  | { key: string; status: "error"; message: string };

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
  const [weatherRequest, setWeatherRequest] = useState<WeatherRequest | null>(
    null,
  );
  const [locationSearch, setLocationSearch] = useState("");
  const [searchedLocation, setSearchedLocation] = useState<string | null>(null);
  const [searchedCoords, setSearchedCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [searchCoordsError, setSearchCoordsError] = useState<string | null>(
    null,
  );

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
    const weatherLocation =
      searchedLocation !== null
        ? searchedCoords
        : (detectedLocation ?? FALLBACK_VENUE);
    if (!weatherLocation) return;

    const controller = new AbortController();
    const requestKey = `${weatherLocation.lat},${weatherLocation.lon}`;

    api
      .weather(weatherLocation.lat, weatherLocation.lon, controller.signal)
      .then((data) =>
        setWeatherRequest({ key: requestKey, status: "success", data }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setWeatherRequest({
          key: requestKey,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the forecast.",
        });
      });

    return () => controller.abort();
  }, [detectedLocation, searchedLocation, searchedCoords]);

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
  const weatherTarget =
    searchedLocation !== null
      ? searchedCoords
      : (detectedLocation ?? FALLBACK_VENUE);
  const weatherKey = weatherTarget
    ? `${weatherTarget.lat},${weatherTarget.lon}`
    : null;
  const weatherLoading =
    weatherKey !== null && weatherRequest?.key !== weatherKey;
  const searchCoordsPending =
    weatherKey === null && searchedLocation !== null && !searchCoordsError;
  const weatherLocationName =
    searchedLocation !== null
      ? searchedLocation
      : detectedLocation?.city
        ? [detectedLocation.city, detectedLocation.country]
            .filter(Boolean)
            .join(", ")
        : "Coogee Beach, Sydney";
  const weather =
    weatherRequest?.key === weatherKey && weatherRequest.status === "success"
      ? weatherRequest.data
      : null;
  const weatherError =
    weatherRequest?.key === weatherKey && weatherRequest.status === "error"
      ? weatherRequest.message
      : null;
  const showingSearchedLocation = searchedLocation !== null;
  const detectedLocationName = detectedLocation?.city
    ? [detectedLocation.city, detectedLocation.country]
        .filter(Boolean)
        .join(", ")
    : venue.lat === FALLBACK_VENUE.lat && venue.lon === FALLBACK_VENUE.lon
      ? "Coogee Beach"
      : "Your location";
  const detectedLocationQuery = detectedLocation?.city
    ? [detectedLocation.city, detectedLocation.country]
        .filter(Boolean)
        .join(", ")
    : venue.lat === FALLBACK_VENUE.lat && venue.lon === FALLBACK_VENUE.lon
      ? "Coogee Beach, Sydney, NSW, Australia"
      : `${venue.lat},${venue.lon}`;
  const locationHeading = showingSearchedLocation
    ? "Location Search"
    : detectedLocation
      ? "Near You"
      : "Featured Venue";
  const locationDescription = searchedLocation
    ? `Showing Google Maps results for ${searchedLocation}.`
    : detectedLocation?.source === "ip" && detectedLocation.city
      ? `Train near ${detectedLocation.city}, ${detectedLocation.country}.`
      : detectedLocation?.source === "browser"
        ? `Your current location (${venue.lat.toFixed(4)}, ${venue.lon.toFixed(4)}).`
        : "Train at Coogee Beach, one of Sydney’s iconic beach volleyball spots.";

  const handleLocationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = locationSearch.trim();
    if (!query) return;

    setSearchedLocation(query);
    setSearchedCoords(null);
    setSearchCoordsError(null);

    api
      .geocode(query)
      .then((result) =>
        setSearchedCoords({ lat: result.latitude, lon: result.longitude }),
      )
      .catch((error: unknown) => {
        setSearchCoordsError(
          error instanceof Error
            ? error.message
            : "Unable to find that location.",
        );
      });
  };

  const useDetectedLocation = () => {
    setLocationSearch("");
    setSearchedLocation(null);
    setSearchedCoords(null);
    setSearchCoordsError(null);
  };

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
          <HomeLocationPanel
            heading={locationHeading}
            searchValue={locationSearch}
            onSearchValueChange={setLocationSearch}
            onSearch={handleLocationSearch}
            showUseMyLocation={showingSearchedLocation}
            onUseMyLocation={useDetectedLocation}
            loading={locationLoading && !showingSearchedLocation}
            error={
              locationError && !detectedLocation && !showingSearchedLocation
                ? locationError
                : null
            }
            description={locationDescription}
            mapName={searchedLocation ?? detectedLocationName}
            mapLatitude={showingSearchedLocation ? null : venue.lat}
            mapLongitude={showingSearchedLocation ? null : venue.lon}
            mapQuery={searchedLocation ?? detectedLocationQuery}
          />
          <WeatherWidget
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            findingLocation={searchCoordsPending}
            searchError={
              searchCoordsError && searchedLocation !== null
                ? searchCoordsError
                : null
            }
            locationName={weatherLocationName}
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

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Category,
  type Drill,
  type Skill,
  type Tournament,
  type TrainingSession,
  type WeatherResponse,
} from "../api";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  PlayCircle,
  Target,
  Trophy,
  FileText,
  ArrowRight,
} from "lucide-react";
import HomeLocationPanel from "../components/locations/HomeLocationPanel";
import PlacesToPlay from "../components/home/PlacesToPlay";
import UpcomingAgenda, {
  type LocalEventRadius,
} from "../components/home/UpcomingAgenda";
import ThreeHourlyConditions from "../components/weather/ThreeHourlyConditions";
import WeatherWidget from "../components/weather/WeatherWidget";
import {
  addDays,
  addMonths,
  monthGridDays,
  toISODate,
  weekGridDays,
} from "../utils/calendar";
import { fetchAllTournamentPages, isAbortError } from "../utils/tournaments";

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

type AgendaRange = "month" | "week";

/** Radius of the agenda's "Within 25 km" location filter, in kilometres. */
const LOCAL_EVENT_RADIUS_KM = 25;

/** The agenda's server-side radius filter, spread into both event queries. */
type AgendaRadiusFilter = {
  latitude?: number;
  longitude?: number;
  radius_km?: number;
};

/**
 * Stable empty filter. Returning this shared object rather than a fresh `{}`
 * keeps an inactive location filter from changing identity, which would refetch
 * the agenda as soon as the detected location arrives.
 */
const NO_RADIUS_FILTER: AgendaRadiusFilter = {};

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
  {
    title: "Tournaments",
    path: "/tournaments",
    icon: Trophy,
    description:
      "Browse upcoming tournaments near you and across the country. Each tournament shows divisions, participants, and results.",
  },
  {
    title: "Organisations",
    path: "/organisations",
    icon: Building2,
    description:
      "Browse volleyball organisations across Australia. View details, locations, and upcoming events for each club.",
  },
  {
    title: "Analysis",
    path: "/analyses",
    icon: FileText,
    description:
      "Review past match and player analysis reports or order a new analysis for your team.",
  },
  {
    title: "Assessment sessions",
    path: "/assessment-sessions",
    icon: CalendarDays,
    description:
      "Record and review player skill assessment sessions to track progress and identify areas for improvement.",
  },
  {
    path: "/ranking-consolidations",
    title: "Ranking consolidations",
    icon: Trophy,
    description:
      "View consolidated player rankings compiled from tournament results and assessment sessions.",
  },
  {
    path: "/assessment-definitions",
    title: "Assessment definitions",
    icon: ClipboardList,
    description:
      "Manage the assessment categories and weightings used to evaluate player skills consistently.",
  },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    [],
  );
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [showMyTournaments, setShowMyTournaments] = useState(false);
  const [showMyTraining, setShowMyTraining] = useState(false);
  const [localEventRadius, setLocalEventRadius] =
    useState<LocalEventRadius>("all");
  const [agendaRange, setAgendaRange] = useState<AgendaRange>("month");
  const [agendaCursor, setAgendaCursor] = useState(() => new Date());
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
  const agendaDays = useMemo(
    () =>
      agendaRange === "month"
        ? monthGridDays(agendaCursor)
        : weekGridDays(agendaCursor),
    [agendaCursor, agendaRange],
  );
  const agendaRangeStart = toISODate(agendaDays[0]);
  const agendaRangeEnd = toISODate(
    addDays(agendaDays[agendaDays.length - 1], 1),
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

  // The location filter measures from the same point the weather panel uses:
  // the searched location when there is one, otherwise the detected location,
  // otherwise the featured venue. While a search is still geocoding there is no
  // point to measure from, so the filter waits for the coordinates rather than
  // silently matching nothing.
  const agendaRadiusFilter = useMemo<AgendaRadiusFilter>(() => {
    if (localEventRadius !== "25km") return NO_RADIUS_FILTER;

    const target =
      searchedLocation !== null
        ? searchedCoords
        : (detectedLocation ?? FALLBACK_VENUE);

    return target === null
      ? NO_RADIUS_FILTER
      : {
          latitude: target.lat,
          longitude: target.lon,
          radius_km: LOCAL_EVENT_RADIUS_KM,
        };
  }, [detectedLocation, localEventRadius, searchedCoords, searchedLocation]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    Promise.all([
      api.trainingSessions({
        starts_at_from: agendaRangeStart,
        starts_at_to: agendaRangeEnd,
        status: "scheduled",
        mine: showMyTraining,
        ...agendaRadiusFilter,
      }),
      fetchAllTournamentPages(
        {
          publication_state: "active",
          mine: showMyTournaments,
          starts_at: agendaRangeStart,
          ends_at: agendaRangeEnd,
          ...agendaRadiusFilter,
        },
        controller.signal,
        api.tournaments,
      ),
    ])
      .then(([sessions, upcomingTournaments]) => {
        if (cancelled) return;
        setTrainingSessions(sessions);
        setTournaments(upcomingTournaments);
        setAgendaError(null);
      })
      .catch((error: unknown) => {
        if (cancelled || isAbortError(error)) return;
        setAgendaError(
          error instanceof Error
            ? error.message
            : "Unable to load upcoming events.",
        );
      })
      .finally(() => {
        if (!cancelled) setAgendaLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    agendaRangeEnd,
    agendaRangeStart,
    agendaRadiusFilter,
    showMyTraining,
    showMyTournaments,
  ]);

  const moveAgendaCursor = (offset: number) => {
    setAgendaLoading(true);
    setAgendaCursor((cursor) =>
      agendaRange === "month"
        ? addMonths(cursor, offset)
        : addDays(cursor, offset * 7),
    );
  };

  const showAgendaToday = () => {
    const today = new Date();
    const todayDays =
      agendaRange === "month" ? monthGridDays(today) : weekGridDays(today);
    const todayRangeStart = toISODate(todayDays[0]);
    const todayRangeEnd = toISODate(
      addDays(todayDays[todayDays.length - 1], 1),
    );
    if (
      todayRangeStart !== agendaRangeStart ||
      todayRangeEnd !== agendaRangeEnd
    ) {
      setAgendaLoading(true);
    }
    setAgendaCursor(today);
  };

  const changeAgendaRange = (range: AgendaRange) => {
    if (range === agendaRange) return;
    setAgendaLoading(true);
    setAgendaRange(range);
  };

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
  const effectiveCoordinates =
    searchedLocation !== null
      ? searchedCoords
      : (detectedLocation ?? FALLBACK_VENUE);
  const weatherKey = effectiveCoordinates
    ? `${effectiveCoordinates.lat},${effectiveCoordinates.lon}`
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
            showHourly={false}
          />
          {weather && (
            <div className="home-hourly">
              <ThreeHourlyConditions
                conditions={Array.isArray(weather.hourly) ? weather.hourly : []}
                timezone={weather.location?.timezone ?? null}
              />
            </div>
          )}
          {effectiveCoordinates && (
            <PlacesToPlay
              latitude={effectiveCoordinates.lat}
              longitude={effectiveCoordinates.lon}
            />
          )}
          <UpcomingAgenda
            trainingSessions={trainingSessions}
            tournaments={tournaments}
            loading={agendaLoading}
            error={agendaError}
            cursor={agendaCursor}
            range={agendaRange}
            onPrevious={() => moveAgendaCursor(-1)}
            onToday={showAgendaToday}
            onNext={() => moveAgendaCursor(1)}
            onRangeChange={changeAgendaRange}
            showMyTournaments={showMyTournaments}
            onShowMyTournamentsChange={(e) =>
              setShowMyTournaments(e.target.checked)
            }
            showMyTraining={showMyTraining}
            onShowMyTrainingChange={(e) => setShowMyTraining(e.target.checked)}
            localEventRadius={localEventRadius}
            onLocalEventRadiusChange={setLocalEventRadius}
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

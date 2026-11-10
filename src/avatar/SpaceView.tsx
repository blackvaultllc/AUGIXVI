import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownToLine, LocateFixed, MapPin, Orbit } from "lucide-react";
import {
  EARTH_REGIONS,
  formatCoordinates,
  projectEarthMarker,
  type EarthRegion,
} from "./spaceNavigation";

type Coordinates = { latitude: number; longitude: number; label: string };

export function SpaceView({
  isEnteringLiveMode,
  isReturningToSpace,
  onEnterLiveMode,
  isLanding = false,
  children,
}: {
  isEnteringLiveMode: boolean;
  isReturningToSpace: boolean;
  onEnterLiveMode: () => void;
  isLanding?: boolean;
  children?: ReactNode;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const marker = location ? projectEarthMarker(location.latitude, location.longitude) : null;

  function focusRegion(region: EarthRegion) {
    setLocation({ ...region, label: `${region.label} (approx. center)` });
    setLocationMessage(`${region.label} selected.`);
    setZoomed(true);
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Device location is unavailable in this browser.");
      return;
    }

    setLocationMessage("Requesting device location…");
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            label: "Device location",
          });
          setLocationMessage("Device location is shown in this browser only.");
          setZoomed(true);
        },
        (error) => {
          const message =
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : error.code === error.POSITION_UNAVAILABLE
                ? "Device location is unavailable."
                : "Device location request timed out.";
          setLocationMessage(message);
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
      );
    } catch {
      setLocationMessage("Device location request could not be started.");
    }
  }

  return (
    <main
      className={`avatar-space-view${isEnteringLiveMode ? " avatar-space-view--entering" : ""}${isReturningToSpace ? " avatar-space-view--returning" : ""}${isLanding ? " avatar-space-view--landing" : ""}`}
      aria-label={isLanding ? "Operator sign-in landing view" : "Earth orbital view"}
    >
      <div className="avatar-space-view__stars avatar-space-view__stars--far" aria-hidden="true" />
      <div className="avatar-space-view__stars avatar-space-view__stars--near" aria-hidden="true" />
      <div className="avatar-space-view__meteor" aria-hidden="true" />
      <div
        className="avatar-space-view__meteor avatar-space-view__meteor--delayed"
        aria-hidden="true"
      />

      {!isLanding && (
        <header className="avatar-space-view__header">
          <p>OSIRIS · ORBITAL ENVIRONMENT</p>
          <h1>One world. Two perspectives.</h1>
          <span>Space view · Earth in orbit</span>
        </header>
      )}

      <section className="avatar-space-view__content" aria-label="Earth and locations">
        <button
          className={`avatar-space-view__earth${zoomed ? " is-zoomed" : ""}`}
          type="button"
          onClick={() => !isLanding && setZoomed((current) => !current)}
          disabled={isLanding}
          aria-label={zoomed ? "Zoom out from Earth" : "Zoom into Earth"}
          aria-pressed={zoomed}
          aria-hidden={isLanding}
          tabIndex={isLanding ? -1 : undefined}
        >
          <span className="avatar-space-view__earth-surface">
            <span className="avatar-space-view__landmasses" aria-hidden="true">
              <span className="avatar-space-view__land avatar-space-view__land--north-america" />
              <span className="avatar-space-view__land avatar-space-view__land--south-america" />
              <span className="avatar-space-view__land avatar-space-view__land--europe-africa" />
              <span className="avatar-space-view__land avatar-space-view__land--asia" />
              <span className="avatar-space-view__land avatar-space-view__land--oceania" />
            </span>
            <span className="avatar-space-view__clouds" />
            {marker && (
              <span
                className="avatar-space-view__marker"
                style={
                  {
                    "--marker-x": `${marker.x}%`,
                    "--marker-y": `${marker.y}%`,
                  } as CSSProperties
                }
              />
            )}
          </span>
          <span className="avatar-space-view__earth-shadow" />
          <span className="avatar-space-view__earth-glow" />
        </button>

        {!isLanding && (
          <>
            <div className="avatar-space-view__location" aria-live="polite">
              <MapPin aria-hidden="true" />
              {location ? (
                <span>
                  {location.label} · {formatCoordinates(location.latitude, location.longitude)}
                </span>
              ) : (
                <span>Select Earth to zoom, then focus a region</span>
              )}
            </div>

            <div className={`avatar-space-view__explorer${zoomed ? " is-open" : ""}`}>
              <p>Choose a region</p>
              <div className="avatar-space-view__regions">
                {EARTH_REGIONS.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => focusRegion(region)}
                    aria-pressed={
                      location?.label === region.label ||
                      location?.label === `${region.label} (approx. center)`
                    }
                  >
                    {region.label}
                  </button>
                ))}
                <button type="button" onClick={useDeviceLocation}>
                  <LocateFixed aria-hidden="true" />
                  Use device location
                </button>
              </div>
              {locationMessage && <span role="status">{locationMessage}</span>}
            </div>
          </>
        )}
      </section>

      {!isLanding && (
        <footer className="avatar-space-view__footer">
          <p>
            <Orbit aria-hidden="true" />
            {zoomed
              ? "Region focus is a local preview; no map service is configured."
              : "Tap the planet to zoom and explore."}
          </p>
          <button
            className="avatar-space-view__enter"
            type="button"
            onClick={onEnterLiveMode}
            disabled={isEnteringLiveMode || isReturningToSpace}
          >
            {isReturningToSpace ? (
              <>
                <Orbit aria-hidden="true" /> Returning to space…
              </>
            ) : isEnteringLiveMode ? (
              <>
                <Orbit aria-hidden="true" /> Entering live mode…
              </>
            ) : (
              <>
                <ArrowDownToLine aria-hidden="true" /> Enter Live Mode
              </>
            )}
          </button>
        </footer>
      )}
      {isLanding && <div className="avatar-space-view__landing-overlay">{children}</div>}
    </main>
  );
}


import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MapStyle = 'Street' | 'Satellite' | 'Terrain' | 'High contrast';

const MAP_STYLES: Record<MapStyle, string> = {
  Street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  Satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  Terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  'High contrast': 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
};

const ATTRIBUTION: Record<MapStyle, string> = {
  Street: '&copy; OpenStreetMap contributors',
  Satellite: 'Tiles &copy; Esri',
  Terrain: 'Map data &copy; OpenStreetMap contributors | OpenTopoMap',
  'High contrast': '&copy; OpenStreetMap contributors, HOT',
};

export function LiveAccessibleMap() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('Street');
  const [destination, setDestination] = useState('');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState(
    'Map ready. Select Locate me to request GPS access.',
  );
  const [locating, setLocating] = useState(false);

  // Initialize the map once.
  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const mapInstance = L.map(mapElement.current).setView(
      [26.8467, 80.9462],
      13,
    );

    const initialLayer = L.tileLayer(MAP_STYLES.Street, {
      maxZoom: 19,
      attribution: ATTRIBUTION.Street,
    });

    initialLayer.addTo(mapInstance);

    mapRef.current = mapInstance;
    tileLayerRef.current = initialLayer;

    const resizeTimer = window.setTimeout(() => {
      mapInstance.invalidateSize();
    }, 250);

    return () => {
      window.clearTimeout(resizeTimer);
      mapInstance.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Change the map style.
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) return;

    if (tileLayerRef.current) {
      mapInstance.removeLayer(tileLayerRef.current);
    }

    const newLayer = L.tileLayer(MAP_STYLES[mapStyle], {
      maxZoom: mapStyle === 'Satellite' ? 19 : 17,
      attribution: ATTRIBUTION[mapStyle],
    });

    newLayer.addTo(mapInstance);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Request the actual browser GPS location.
  const locateMe = () => {
    if (!navigator.geolocation) {
      setStatus('GPS is not supported by this browser.');
      return;
    }

    setLocating(true);
    setStatus('Requesting your GPS location...');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: [number, number] = [
          coords.latitude,
          coords.longitude,
        ];

        setPosition(point);

        const mapInstance = mapRef.current;

        if (mapInstance) {
          if (markerRef.current) {
            markerRef.current.setLatLng(point);
          } else {
            markerRef.current = L.marker(point, {
              title: 'Your current GPS location',
              alt: 'Your current GPS location',
            })
              .addTo(mapInstance)
              .bindPopup('Your current GPS location');
          }

          mapInstance.setView(point, 17);
          markerRef.current.openPopup();
        }

        setStatus(
          `GPS location: ${point[0].toFixed(5)}, ${point[1].toFixed(5)}`,
        );
        setLocating(false);
      },
      (error) => {
        if (error.code === 1) {
          setStatus(
            'Location permission denied. Allow location access in your browser settings.',
          );
        } else if (error.code === 3) {
          setStatus('GPS timed out. Please try again.');
        } else {
          setStatus('Location unavailable. Check GPS and try again.');
        }

        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    );
  };

  // Open walking directions in Google Maps.
  const getDirections = () => {
    const target = destination.trim();

    if (!target) {
      setStatus('Please enter a destination first.');
      return;
    }

    const params = new URLSearchParams({
      api: '1',
      destination: target,
      travelmode: 'walking',
    });

    if (position) {
      params.set('origin', `${position[0]},${position[1]}`);
    }

    window.open(
      `https://www.google.com/maps/dir/?${params.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );

    setStatus(
      position
        ? 'Opening walking directions from your GPS location.'
        : 'Opening walking directions. Enable GPS to use your current location as the origin.',
    );
  };

  return (
    <section className="w-full space-y-3 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Accessible Map</h2>
          <p className="text-xs text-slate-400">
            Interactive map with GPS location and walking directions
          </p>
        </div>

        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {locating ? 'Finding location...' : '◎ Locate me'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Map style">
        {(Object.keys(MAP_STYLES) as MapStyle[]).map((style) => (
          <button
            type="button"
            key={style}
            onClick={() => setMapStyle(style)}
            aria-pressed={mapStyle === style}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              mapStyle === style
                ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
            }`}
          >
            {style}
          </button>
        ))}
      </div>

      <div
        ref={mapElement}
        role="region"
        aria-label="Interactive map. Use controls to zoom and pan."
        className="w-full overflow-hidden rounded-xl border border-slate-600 bg-slate-800"
        style={{ height: 380, minHeight: 300 }}
      />

      <p
        role="status"
        aria-live="polite"
        className="break-words rounded-lg bg-slate-800 p-3 text-xs text-slate-200"
      >
        {status}
      </p>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          getDirections();
        }}
      >
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="Enter destination or address"
          aria-label="Destination"
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-white placeholder:text-slate-400"
        />

        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
        >
          Walking directions ↗
        </button>
      </form>

      <p className="text-xs leading-relaxed text-amber-300">
        Safety notice: Google Maps walking directions are not verified for
        wheelchair accessibility, tactile paving, ramps, or live obstacles.
        GPS requires browser permission and a secure context such as localhost
        or HTTPS. Do not rely on this map alone for safe navigation.
      </p>
    </section>
  );
}

export default LiveAccessibleMap;

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MapStyle = 'Street' | 'Satellite' | 'Terrain' | 'High contrast';
type LatLng = [number, number];

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

type GeocodeResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type ValhallaResponse = {
  trip?: {
    legs?: Array<{ shape?: string; summary?: { length?: number; time?: number } }>;
    summary?: { length?: number; time?: number };
    status?: number;
    status_message?: string;
  };
};

function decodePolyline(encoded: string, precision = 6): LatLng[] {
  const factor = Math.pow(10, precision);
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / factor, lng / factor]);
  }

  return points;
}

export function LiveAccessibleMap() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('Street');
  const [destination, setDestination] = useState('');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState(
    'Map ready. Select Locate me, then enter a destination to find it on this map.',
  );
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const map = L.map(mapElement.current).setView([26.8467, 80.9462], 13);
    const layer = L.tileLayer(MAP_STYLES.Street, {
      maxZoom: 19,
      attribution: ATTRIBUTION.Street,
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = layer;

    // Leaflet needs a size refresh after the responsive dashboard layout settles.
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 300);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    if (mapElement.current) resizeObserver.observe(mapElement.current);

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      currentMarkerRef.current = null;
      destinationMarkerRef.current = null;
      routeLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const layer = L.tileLayer(MAP_STYLES[mapStyle], {
      maxZoom: mapStyle === 'Satellite' ? 19 : 17,
      attribution: ATTRIBUTION[mapStyle],
    }).addTo(map);
    tileLayerRef.current = layer;
  }, [mapStyle]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setStatus('GPS is not supported by this browser.');
      return;
    }

    setLocating(true);
    setStatus('Requesting your GPS location…');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: LatLng = [coords.latitude, coords.longitude];
        setPosition(point);

        const map = mapRef.current;
        if (map) {
          if (currentMarkerRef.current) {
            currentMarkerRef.current.setLatLng(point);
          } else {
            currentMarkerRef.current = L.marker(point, {
              title: 'Your current GPS location',
              alt: 'Your current GPS location',
            }).addTo(map);
          }
          currentMarkerRef.current
            .bindPopup('Your current GPS location')
            .openPopup();
          map.setView(point, 16);
        }

        setStatus(`Your GPS location is set (${point[0].toFixed(5)}, ${point[1].toFixed(5)}). Enter a destination to plan a pedestrian route.`);
        setLocating(false);
      },
      (error) => {
        setStatus(
          error.code === 1
            ? 'Location permission denied. Allow location access in browser settings.'
            : error.code === 3
              ? 'GPS timed out. Please try again.'
              : 'Location unavailable. Check GPS and try again.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };

  const findDestination = async () => {
    const query = destination.trim();
    if (!query) {
      setStatus('Enter a place name or address first.');
      return;
    }

    setSearching(true);
    setStatus(`Searching for “${query}”…`);

    try {
      const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search');
      geocodeUrl.search = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '1',
        addressdetails: '1',
      }).toString();

      const geocodeResponse = await fetch(geocodeUrl.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!geocodeResponse.ok) {
        throw new Error(`Place search failed (HTTP ${geocodeResponse.status}).`);
      }

      const results = (await geocodeResponse.json()) as GeocodeResult[];
      if (!results.length) {
        setStatus(`No place found for “${query}”. Try a fuller name, area, or city.`);
        return;
      }

      const found = results[0];
      const target: LatLng = [Number(found.lat), Number(found.lon)];
      if (!Number.isFinite(target[0]) || !Number.isFinite(target[1])) {
        throw new Error('The place search returned an invalid location.');
      }

      const map = mapRef.current;
      if (!map) throw new Error('The map is not ready.');

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng(target);
      } else {
        destinationMarkerRef.current = L.marker(target, {
          title: 'Searched destination',
          alt: 'Searched destination',
        }).addTo(map);
      }
      destinationMarkerRef.current
        .bindPopup(() => {
          const popup = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = 'Destination';
          popup.appendChild(title);
          popup.appendChild(document.createElement('br'));
          popup.appendChild(document.createTextNode(found.display_name));
          return popup;
        })
        .openPopup();

      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }

      if (!position) {
        map.setView(target, 16);
        setStatus(`Found: ${found.display_name}. Destination is shown on the map. Select Locate me to request your starting point and plan a route.`);
        return;
      }

      setStatus('Destination found. Requesting a pedestrian route…');

      // Valhalla's public OSM demo router supports pedestrian costing.
      const routeResponse = await fetch('https://valhalla1.openstreetmap.de/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          locations: [
            { lat: position[0], lon: position[1] },
            { lat: target[0], lon: target[1] },
          ],
          costing: 'pedestrian',
          directions_options: { units: 'kilometers' },
        }),
      });

      if (!routeResponse.ok) {
        map.fitBounds(L.latLngBounds([position, target]), { padding: [35, 35] });
        setStatus(`Found ${found.display_name}, but the pedestrian routing service is unavailable right now. Both locations are shown; no route has been confirmed.`);
        return;
      }

      const routeData = (await routeResponse.json()) as ValhallaResponse;
      const encodedShape = routeData.trip?.legs?.[0]?.shape;
      if (!encodedShape || routeData.trip?.status) {
        map.fitBounds(L.latLngBounds([position, target]), { padding: [35, 35] });
        setStatus(`Found ${found.display_name}, but a pedestrian route could not be calculated. The destination is marked on the map.`);
        return;
      }

      const routePoints = decodePolyline(encodedShape, 6);
      if (routePoints.length < 2) {
        throw new Error('The routing service returned an incomplete route.');
      }

      routeLineRef.current = L.polyline(routePoints, {
        color: '#06b6d4',
        weight: 5,
        opacity: 0.9,
      }).addTo(map);

      map.fitBounds(routeLineRef.current.getBounds(), { padding: [35, 35] });
      const summary = routeData.trip?.summary;
      const km = summary?.length;
      const minutes = summary?.time != null ? Math.max(1, Math.round(summary.time / 60)) : null;
      const routeSummary = km != null
        ? ` Approximate route: ${km.toFixed(2)} km${minutes != null ? `, about ${minutes} minutes on foot` : ''}.`
        : '';
      setStatus(`Pedestrian route displayed to ${found.display_name}.${routeSummary} Map data and routing may be incomplete; verify accessibility and surroundings before travelling.`);
    } catch (error) {
      console.error('Destination search/routing failed:', error);
      setStatus(error instanceof Error
        ? `${error.message} Check your internet connection and try again.`
        : 'Could not search or route to this destination. Try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="w-full space-y-3 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Accessible Map</h2>
          <p className="text-xs text-slate-400">
            Search places, show your GPS position, and display a pedestrian route inside the app
          </p>
        </div>
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {locating ? 'Finding location…' : '◎ Locate me'}
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
        className="relative z-0 block w-full max-w-full overflow-hidden rounded-xl border border-slate-600 bg-slate-800"
        style={{ height: 'clamp(240px, 38vh, 340px)', minHeight: 240, maxHeight: 340 }}
      />

      <p role="status" aria-live="polite" className="break-words rounded-lg bg-slate-800 p-3 text-xs text-slate-200">
        {status}
      </p>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void findDestination();
        }}
      >
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="e.g. Dr Shakuntala Misra University, Lucknow"
          aria-label="Destination"
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-white placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {searching ? 'Searching…' : 'Find & route here'}
        </button>
      </form>

      <p className="text-xs leading-relaxed text-amber-300">
        Safety notice: routes depend on third-party OpenStreetMap-based services and may not account for wheelchair access, tactile paving, ramps, construction, or live obstacles. Do not rely on this map alone for safety-critical navigation.
      </p>
    </section>
  );
}

export default LiveAccessibleMap;

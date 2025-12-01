import React, { useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type BookingRequest = {
  id: string;
  name: string;
  business: string;
  town: string;
  date: string;
  description: string;
  phone: string;
  email: string;
  createdAt?: any;
};

type RequestsTabProps = {
  requests: BookingRequest[];
  loading: boolean;
  error?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
  menus: any[];
  menuMap: Map<string, string | undefined>;
};

export default function RequestsTab({ requests, loading, error, showToast, menus, menuMap }: RequestsTabProps) {
    // --- Map location search logic (copied from Days tab) ---
    const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || "";
    const GEOAPIFY_MIN_QUERY_LENGTH = 3;
    type MapProvider = "openstreetmap" | "google";
    const DEFAULT_MAP_PROVIDER: MapProvider = "openstreetmap";
    const MAP_PROVIDER_OPTIONS = [
      { id: "openstreetmap", label: "OpenStreetMap" },
      { id: "google", label: "Google Maps" }
    ];
    function buildMapLinkForProvider(lat: number, lon: number, provider: MapProvider) {
      const clampedLat = Number.isFinite(lat) ? lat.toFixed(6) : "";
      const clampedLon = Number.isFinite(lon) ? lon.toFixed(6) : "";
      if (!clampedLat || !clampedLon) return "";
      if (provider === "google") {
        return `https://www.google.com/maps/search/?api=1&query=${clampedLat},${clampedLon}`;
      }
      return `https://www.openstreetmap.org/?mlat=${clampedLat}&mlon=${clampedLon}#map=16/${clampedLat}/${clampedLon}`;
    }
    function extractLatLngFromUrl(url: string) {
      if (!url) return null;
      const decoded = decodeURIComponent(url);
      const bareCoordsMatch = decoded.trim().match(/^(-?\d+(?:\.\d+)?)(?:\s*,\s*|\s+)(-?\d+(?:\.\d+)?$)/);
      if (bareCoordsMatch) {
        return { lat: parseFloat(bareCoordsMatch[1]), lng: parseFloat(bareCoordsMatch[2]) };
      }
      const mlatMatch = decoded.match(/[?&#]mlat=(-?\d+(?:\.\d+)?)/i);
      const mlonMatch = decoded.match(/[?&#]mlon=(-?\d+(?:\.\d+)?)/i);
      if (mlatMatch && mlonMatch) {
        return { lat: parseFloat(mlatMatch[1]), lng: parseFloat(mlonMatch[1]) };
      }
      const queryMatch = decoded.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
      if (queryMatch) {
        return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
      }
      const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }
      return null;
    }
    function looksLikeMapInput(value: string) {
      const trimmed = value.trim();
      if (!trimmed) return false;
      if (/^https?:\/\//i.test(trimmed)) return true;
      if (/^-?\d+(?:\.\d+)?(?:\s*,\s*|\s+)-?\d+(?:\.\d+)?$/.test(trimmed)) return true;
      return Boolean(extractLatLngFromUrl(trimmed));
    }
    // --- End map logic ---

    // Map search state
    const [mapsUrl, setMapsUrl] = useState("");
    const [mapsSearchText, setMapsSearchText] = useState("");
    const [mapsCoords, setMapsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [mapProvider, setMapProvider] = useState<MapProvider>(DEFAULT_MAP_PROVIDER);
    const [mapsSuggestions, setMapsSuggestions] = useState<any[]>([]);
    const [mapsLoading, setMapsLoading] = useState(false);
    const [mapsError, setMapsError] = useState<string | null>(null);
    const [mapsLinkIsManual, setMapsLinkIsManual] = useState(false);
    const [showSuggestionMenu, setShowSuggestionMenu] = useState(false);
    const mapsInputRef = React.useRef<HTMLInputElement | null>(null);

    // Geoapify autocomplete (copied from Days tab)
    React.useEffect(() => {
      if (!GEOAPIFY_API_KEY || mapsLinkIsManual) {
        setMapsSuggestions([]);
        setMapsLoading(false);
        setShowSuggestionMenu(false);
        return;
      }
      const query = mapsSearchText.trim();
      if (!query || query.length < GEOAPIFY_MIN_QUERY_LENGTH) {
        setMapsSuggestions([]);
        setMapsLoading(false);
        setShowSuggestionMenu(false);
        return;
      }
      setMapsLoading(true);
      setShowSuggestionMenu(true);
      fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`)
        .then(res => res.json())
        .then(data => {
          const features = Array.isArray(data?.features) ? data.features : [];
          const suggestions = features.map((feature: any) => {
            const props = feature?.properties ?? {};
            const geometry = feature?.geometry;
            const lon = typeof props.lon === "number" ? props.lon : geometry?.coordinates?.[0];
            const lat = typeof props.lat === "number" ? props.lat : geometry?.coordinates?.[1];
            if (typeof lat !== "number" || typeof lon !== "number") return null;
            const primary = props.address_line1 || props.name || props.street || props.formatted || "";
            const secondaryParts = [props.address_line2, props.city, props.state_code || props.state, props.country].filter(Boolean);
            const secondary = secondaryParts.join(", ") || undefined;
            const id = props.place_id || props.datasource?.raw?.osm_id || `${lat},${lon}`;
            if (!primary || !id) return null;
            return { id: String(id), label: primary, secondary, lat, lon };
          }).filter(Boolean);
          setMapsSuggestions(suggestions);
          setMapsLoading(false);
          setMapsError(null);
        })
        .catch(() => {
          setMapsSuggestions([]);
          setMapsLoading(false);
          setMapsError("Unable to fetch location suggestions right now.");
        });
    }, [mapsSearchText, GEOAPIFY_API_KEY, mapsLinkIsManual]);
    // Normalize time inputs
    function normalizeTime(input: string): string {
      const raw = input.trim();
      if (!raw) return "";
      const collapsed = raw.toLowerCase().replace(/\s+/g, "");
      const re = /^(\d{1,2})(?:[:\.](\d{2}))?(am|pm)?$/i;
      let m = collapsed.match(re);
      let hour: number | null = null;
      let minute: number | null = null;
      let suffix: string | null = null;
      if (m) {
        hour = parseInt(m[1], 10);
        minute = m[2] ? parseInt(m[2], 10) : 0;
        suffix = m[3] ? m[3].toUpperCase() : null;
      } else if (/^\d{3,4}$/.test(collapsed)) {
        if (collapsed.length === 3) {
          hour = parseInt(collapsed.slice(0, 1), 10);
          minute = parseInt(collapsed.slice(1), 10);
        } else {
          hour = parseInt(collapsed.slice(0, 2), 10);
          minute = parseInt(collapsed.slice(2), 10);
        }
      } else {
        return raw;
      }
      if (hour == null || minute == null || isNaN(hour) || isNaN(minute)) return raw;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return raw;
      if (suffix) {
        if (hour < 1 || hour > 12) return raw;
        const displayHour = hour;
        const mm = minute.toString().padStart(2, "0");
        return `${displayHour}:${mm} ${suffix}`;
      }
      let inferredSuffix: string;
      let displayHour: number;
      if (hour === 0) {
        inferredSuffix = "AM";
        displayHour = 12;
      } else if (hour === 12) {
        inferredSuffix = "PM";
        displayHour = 12;
      } else if (hour > 12) {
        inferredSuffix = "PM";
        displayHour = hour - 12;
      } else {
        inferredSuffix = "AM";
        displayHour = hour;
      }
      const mm = minute.toString().padStart(2, "0");
      return `${displayHour}:${mm} ${inferredSuffix}`;
    }
  const [busy, setBusy] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  // Add Event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  // Always use Default Menu
  const defaultMenuId = menus.find(m => m.name?.toLowerCase() === "default menu")?.id || "";
  const [eventMenuId, setEventMenuId] = useState(defaultMenuId);
  const [addEventBusy, setAddEventBusy] = useState(false);

  async function removeRequest(id: string) {
    setBusy(true);
    try {
      await deleteDoc(doc(db, "bookingRequests", id));
      showToast("Request removed", "success");
    } catch (e) {
      showToast("Failed to remove request", "error");
    } finally {
      setBusy(false);
    }
  }

  function contactHref(req: BookingRequest) {
    if (req.email) {
      const subject = encodeURIComponent("Booking Request Follow-up");
      const body = encodeURIComponent(`Hi ${req.name},\n\nRegarding your booking request for ${req.date} in ${req.town}.\n\nDetails: ${req.description}`);
      return `mailto:${req.email}?subject=${subject}&body=${body}`;
    }
    return undefined;
  }

  function bookRequest(req: BookingRequest) {
    setActiveRequestId(String(req.id));
    setEventTitle(req.business ? `${req.business} (${req.name})` : req.name);
    setEventLocation(req.town);
    setEventStartTime("");
    setEventEndTime("");
    setEventMenuId(defaultMenuId);
    setMapsUrl("");
    setMapsSearchText("");
    setMapsCoords(null);
    setMapsLinkIsManual(false);
    setMapProvider(DEFAULT_MAP_PROVIDER);
  }

  async function handleAddEvent(req: BookingRequest) {
    if (!req.date || !eventTitle || !eventLocation) return;
    setAddEventBusy(true);
    try {
      await addDoc(collection(db, "events"), {
        dateStr: req.date,
        title: eventTitle,
        location: eventLocation,
        startTime: normalizeTime(eventStartTime),
        endTime: normalizeTime(eventEndTime),
        menuId: defaultMenuId,
        mapsUrl: mapsUrl.trim(),
        mapsLabel: mapsUrl.trim() ? mapsSearchText.trim() : "",
        mapsProvider: !mapsLinkIsManual && mapsCoords ? mapProvider : null,
        createdAt: serverTimestamp(),
      });
      // Remove the request after adding event
      await deleteDoc(doc(db, "bookingRequests", req.id));
      showToast("Event added and request removed", "success");
      setActiveRequestId(null);
      setEventTitle("");
      setEventLocation("");
      setEventStartTime("");
      setEventEndTime("");
      setEventMenuId(defaultMenuId);
      setMapsUrl("");
      setMapsSearchText("");
      setMapsCoords(null);
      setMapsLinkIsManual(false);
      setMapProvider(DEFAULT_MAP_PROVIDER);
    } catch (e) {
      showToast("Failed to add event", "error");
    } finally {
      setAddEventBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/60 bg-white/95 p-6 shadow-lg shadow-black/10 backdrop-blur">
        <h2 className="text-xl font-semibold text-neutral-900">Booking Requests:</h2>
        {loading && <div className="mt-4 text-sm text-neutral-600">Loading...</div>}
        {!loading && error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && requests.length === 0 && (
          <div className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-600">No booking requests.</div>
        )}
        <ul className="mt-4 divide-y divide-neutral-200">
          {requests.map((req) => (
            <li key={req.id} className="py-5">
              <div className="font-medium text-lg text-neutral-900">{req.business ? `${req.business} (${req.name})` : req.name}</div>
              <div className="mt-1 text-sm text-neutral-700">
                <span className="font-semibold">Date:</span> {req.date || "N/A"}
                <span className="font-semibold ml-2">Location:</span> {req.town || "N/A"}
                {req.phone && (
                  <span className="ml-2"><span className="font-semibold">Phone:</span> {req.phone}</span>
                )}
                {req.email && (
                  <span className="ml-2"><span className="font-semibold">Email:</span> {req.email}</span>
                )}
              </div>
              <div className="mt-2 text-sm text-neutral-700">
                <span className="font-semibold">Details:</span> {req.description || "(none)"}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => bookRequest(req)}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  Book
                </button>
                <button
                  onClick={() => removeRequest(req.id)}
                  disabled={busy}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
                {req.email && (
                  <a
                    href={contactHref(req)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Contact
                  </a>
                )}
              </div>
            {/* Show Add Event form below the request if active */}
            {String(activeRequestId) === String(req.id) && (
              <div className="mt-4 p-4 border rounded bg-gray-50">
                <h3 className="text-lg font-semibold mb-2">Add Event</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Event Title</label>
                    <input
                      className="rounded px-3 py-2 border"
                      value={eventTitle}
                      onChange={e => setEventTitle(e.target.value)}
                      placeholder="Event title"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Location</label>
                    <input
                      className="rounded px-3 py-2 border"
                      value={eventLocation}
                      onChange={e => setEventLocation(e.target.value)}
                      placeholder="Location"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Start Time</label>
                    <input
                      className="rounded px-3 py-2 border"
                      value={eventStartTime}
                      onChange={e => setEventStartTime(e.target.value)}
                      onBlur={() => setEventStartTime(prev => normalizeTime(prev))}
                      placeholder="e.g., 1pm, 1:30pm, 13:30"
                    />
                    <p className="text-xs text-black/50">You can type "1pm", "130pm", "1:30 pm", "13", or "1330". It will auto-format.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">End Time</label>
                    <input
                      className="rounded px-3 py-2 border"
                      value={eventEndTime}
                      onChange={e => setEventEndTime(e.target.value)}
                      onBlur={() => setEventEndTime(prev => normalizeTime(prev))}
                      placeholder="e.g., 2pm, 2:15pm, 14:15"
                    />
                    <p className="text-xs text-black/50">Same shorthand supported; we'll normalize automatically.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Menu</label>
                    <select
                      className="rounded px-3 py-2 border"
                      value={eventMenuId}
                      onChange={e => setEventMenuId(e.target.value)}
                    >
                      {menus.map(m => (
                        <option key={m.id} value={m.id}>{m.name ?? m.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-sm">Map Location Search</label>
                    <div className="relative">
                      <input
                        ref={mapsInputRef}
                        className="w-full rounded px-3 py-2 border"
                        value={mapsSearchText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMapsSearchText(val);
                          const trimmed = val.trim();
                          if (!trimmed) {
                            setMapsUrl("");
                            setMapsCoords(null);
                            setMapsLinkIsManual(false);
                            setShowSuggestionMenu(false);
                            setMapProvider(DEFAULT_MAP_PROVIDER);
                            return;
                          }
                          if (looksLikeMapInput(trimmed)) {
                            setMapsSuggestions([]);
                            setMapsLoading(false);
                            setMapsUrl(trimmed);
                            setMapsLinkIsManual(true);
                            setShowSuggestionMenu(false);
                            const coords = extractLatLngFromUrl(trimmed);
                            setMapsCoords(coords ?? null);
                          } else {
                            setMapsUrl("");
                            setMapsCoords(null);
                            setMapsLinkIsManual(false);
                            setShowSuggestionMenu(trimmed.length >= GEOAPIFY_MIN_QUERY_LENGTH);
                          }
                        }}
                        placeholder="Search for an address or paste a map link"
                        autoComplete="off"
                      />
                      {showSuggestionMenu && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1">
                          {mapsLoading ? (
                            <div className="rounded-lg border bg-white px-3 py-2 text-xs text-black/60">Searching...</div>
                          ) : mapsSuggestions.length > 0 ? (
                            <ul className="max-h-60 overflow-auto rounded-lg border bg-white shadow-lg">
                              {mapsSuggestions.map((suggestion) => (
                                <li key={suggestion.id}>
                                  <button
                                    type="button"
                                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-black/5"
                                    onMouseDown={(evt) => {
                                      evt.preventDefault();
                                      setMapsSearchText(suggestion.label);
                                      setMapsCoords({ lat: suggestion.lat, lng: suggestion.lon });
                                      setMapsUrl(buildMapLinkForProvider(suggestion.lat, suggestion.lon, mapProvider));
                                      setShowSuggestionMenu(false);
                                    }}
                                  >
                                    <span className="text-sm font-medium text-black">{suggestion.label}</span>
                                    {suggestion.secondary && (
                                      <span className="text-xs text-black/60">{suggestion.secondary}</span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="rounded-lg border bg-white px-3 py-2 text-xs text-black/60">No matches found for "{mapsSearchText.trim()}".</div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Map preview below input */}
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                        <img
                          src={`https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&type=map&format=png&scaleFactor=2&width=600&height=360&zoom=14&center=lonlat:${mapsCoords?.lng},${mapsCoords?.lat}&marker=lonlat:${mapsCoords?.lng},${mapsCoords?.lat};type:awesome;icon:map-marker;icontype:awesome;color:%23dd2c00;size:large&apiKey=${GEOAPIFY_API_KEY}`}
                          alt={`Map preview for ${mapsSearchText}`}
                          className="h-48 w-full rounded-lg border object-cover"
                          loading="lazy"
                        />
                        <span className="mt-1 block text-xs text-black/60">Preview - open map in a new tab</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      await handleAddEvent(req);
                    }}
                    disabled={addEventBusy || !req.date || !eventTitle || !eventLocation}
                    className="rounded bg-red-800 text-white px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    Add Event
                  </button>
                  <button
                    onClick={() => setActiveRequestId(null)}
                    className="rounded bg-black/10 px-4 py-2 font-medium hover:bg-black/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

// DaysTab implementation from AdminDashboard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "@/components/Calendar";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, getDoc, getDocs } from "firebase/firestore";

// Utility types from AdminDashboard.tsx
type StationEvent = {
  id: string;
  dateStr: string;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  menuId: string;
  mapsUrl?: string;
  mapsLabel?: string;
  mapsProvider?: string | null;
  createdAt?: any;
};
type MenuDoc = {
  id: string;
  name?: string;
  sections?: any[];
  createdAt?: any;
};
type MapProvider = "openstreetmap" | "google";
type MapCoords = { lat: number; lng: number };
type MapSuggestion = { id: string; label: string; secondary?: string; lat: number; lon: number };

// src/components/AdminDashboard.tsx

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";


import RequestsTab from "@/components/RequestsTab";
import { uploadMenuItemPhoto, deleteMenuItemPhoto } from "@/lib/upload-menu-image";

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || "";
const GEOAPIFY_MIN_QUERY_LENGTH = 3;


const DEFAULT_MAP_PROVIDER: MapProvider = "openstreetmap";

const MAP_PROVIDER_OPTIONS: Array<{ id: MapProvider; label: string }> = [
  { id: "openstreetmap", label: "OpenStreetMap" },
  { id: "google", label: "Google Maps" }
];

function buildGeoapifyMapsLink(lat: number, lon: number) {
  const clampedLat = Number.isFinite(lat) ? lat.toFixed(6) : "";
  const clampedLon = Number.isFinite(lon) ? lon.toFixed(6) : "";
  if (!clampedLat || !clampedLon) return "";
  return `https://www.openstreetmap.org/?mlat=${clampedLat}&mlon=${clampedLon}#map=16/${clampedLat}/${clampedLon}`;
}

function buildStaticMapUrl(lat: number, lon: number) {
  if (!GEOAPIFY_API_KEY) return "";
  const url = new URL("https://maps.geoapify.com/v1/staticmap");
  url.searchParams.set("style", "osm-bright-smooth");
  url.searchParams.set("type", "map");
  url.searchParams.set("format", "png");
  url.searchParams.set("scaleFactor", "2");
  url.searchParams.set("width", "600");
  url.searchParams.set("height", "360");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("center", `lonlat:${lon},${lat}`);
  url.searchParams.set(
    "marker",
    `lonlat:${lon},${lat};type:awesome;icon:map-marker;icontype:awesome;color:%23dd2c00;size:large`
  );
  url.searchParams.set("apiKey", GEOAPIFY_API_KEY);
  return url.toString();
}

function buildOpenStreetMapEmbedUrl(lat: number, lon: number) {
  const delta = 0.01;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("layer", "mapnik");
  url.searchParams.set("marker", `${lat},${lon}`);
  return url.toString();
}

function buildMapLinkForProvider(lat: number, lon: number, provider: MapProvider) {
  const clampedLat = Number.isFinite(lat) ? lat.toFixed(6) : "";
  const clampedLon = Number.isFinite(lon) ? lon.toFixed(6) : "";
  if (!clampedLat || !clampedLon) return "";
  if (provider === "google") {
    return `https://www.google.com/maps/search/?api=1&query=${clampedLat},${clampedLon}`;
  }
  return buildGeoapifyMapsLink(Number(clampedLat), Number(clampedLon));
}

function detectMapProvider(url: string): MapProvider | null {
  if (!url) return null;
  const value = url.toLowerCase();
  if (value.includes("google.com/maps") || value.includes("goo.gl/maps") || value.includes("maps.app.goo.gl")) {
    return "google";
  }
  if (value.includes("openstreetmap.org") || value.includes("geoapify.com")) {
    return "openstreetmap";
  }
  return null;
}

function coordsAreEqual(a: MapCoords | null, b: MapCoords | null) {
  if (!a || !b) return !a && !b;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

function extractLatLngFromUrl(url: string) {
  if (!url) return null;
  const decoded = decodeURIComponent(url);

  const bareCoordsMatch = decoded.trim().match(/^(-?\d+(?:\.\d+)?)(?:\s*,\s*|\s+)(-?\d+(?:\.\d+)?)$/);
  if (bareCoordsMatch) {
    return { lat: parseFloat(bareCoordsMatch[1]), lng: parseFloat(bareCoordsMatch[2]) };
  }

  const mlatMatch = decoded.match(/[?&#]mlat=(-?\d+(?:\.\d+)?)/i);
  const mlonMatch = decoded.match(/[?&#]mlon=(-?\d+(?:\.\d+)?)/i);
  if (mlatMatch && mlonMatch) {
    return { lat: parseFloat(mlatMatch[1]), lng: parseFloat(mlonMatch[1]) };
  }

  const lonlatMatch = decoded.match(/lonlat[:=](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (lonlatMatch) {
    return { lat: parseFloat(lonlatMatch[2]), lng: parseFloat(lonlatMatch[1]) };
  }

  const queryMatch = decoded.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }

  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/i);
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
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

export function DaysTab({
  menus,
  menuMap
}: {
  menus: MenuDoc[];
  menuMap: Map<string, string | undefined>;
}) {
  // Auto-select current date on mount, or use query params for pre-fill
  function getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Read query params for pre-fill (only runs client-side)
  function getInitialFromQuery() {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const initial: any = {};
    if (params.has("date")) initial.date = params.get("date");
    if (params.has("title")) initial.title = params.get("title");
    if (params.has("location")) initial.location = params.get("location");
    if (params.has("description")) initial.description = params.get("description");
    if (params.has("phone")) initial.phone = params.get("phone");
    if (params.has("email")) initial.email = params.get("email");
    if (params.has("custom")) initial.custom = params.get("custom");
    return initial;
  }

  // State for event form
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayISO());
  const [events, setEvents] = useState<StationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<
    { title: string; last: Pick<StationEvent, "location"|"startTime"|"endTime"|"menuId"|"mapsUrl"|"mapsLabel"|"mapsProvider"> }[]
  >([]);
  const [presetTitle, setPresetTitle] = useState<string>("");
    const [eventError, setEventError] = useState<string>("");
    const [eventSuccess, setEventSuccess] = useState<string>("");
  const [useCustom, setUseCustom] = useState<boolean>(true);
  const [evId, setEvId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // Default menu selection logic
  const defaultMenuId = menus.find(m => m.name === "Default Menu")?.id || (menus.length > 0 ? menus[0].id : "");
  const [menuId, setMenuId] = useState<string>("");

  // Ensure menuId is set to default on mount and when menus change
  useEffect(() => {
    if (!menuId && defaultMenuId) {
      setMenuId(defaultMenuId);
    }
  }, [defaultMenuId, menuId, menus]);
  const [mapsUrl, setMapsUrl] = useState("");
  const [mapsSearchText, setMapsSearchText] = useState("");
  // On mount, check for query params and pre-fill form if present
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hasCustom = params.get("custom") === "1";
    if (hasCustom) {
      setUseCustom(true);
      if (params.get("date")) setSelectedDate(params.get("date"));
      if (params.get("title")) setTitle(params.get("title") || "");
      if (params.get("location")) setLocation(params.get("location") || "");
      // Add more fields if needed
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  type MapPreviewState = { src?: string; embed?: string; description: string };
  const [mapsPreview, setMapsPreview] = useState<MapPreviewState | null>(null);
  const [mapsPreviewMode, setMapsPreviewMode] = useState<"image" | "embed" | "none">("none");
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsSuggestions, setMapsSuggestions] = useState<MapSuggestion[]>([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsLinkIsManual, setMapsLinkIsManual] = useState(false);
  const [mapsCoords, setMapsCoords] = useState<MapCoords | null>(null);
  const [mapProvider, setMapProvider] = useState<MapProvider>(DEFAULT_MAP_PROVIDER);
  const [mapsEmbedInteractive, setMapsEmbedInteractive] = useState(false);
  const [showSuggestionMenu, setShowSuggestionMenu] = useState(false);
  const mapsInputRef = useRef<HTMLInputElement | null>(null);
  const suggestionRequestIdRef = useRef(0);
  const skipNextSuggestionFetchRef = useRef(false);
  const suggestionAbortControllerRef = useRef<AbortController | null>(null);
  const hasGeoapifyKey = Boolean(GEOAPIFY_API_KEY);
  const trimmedMapsQuery = mapsSearchText.trim();

  // Normalize time inputs like "1pm", "130pm", "1:30pm", "13", "1330" into "h:mm AM/PM"

  // Build presets from ALL events (group by title, take most recent by createdAt)
  useEffect(() => {
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
  type Acc = Record<string, { ts: number; location?: string; startTime?: string; endTime?: string; menuId?: string; mapsUrl?: string; mapsLabel?: string; mapsProvider?: MapProvider | null }>;
      const acc: Acc = {};
      for (const d of snap.docs) {
        const data = d.data() as any;
        const t = (data.title ?? "").trim();
        if (!t) continue;
        const ts =
          (data.createdAt?.toMillis?.() ? data.createdAt.toMillis() : 0) ||
          (data._createdAt?.toMillis?.() ? data._createdAt.toMillis() : 0) ||
          0;
        if (!acc[t] || ts >= acc[t].ts) {
          acc[t] = {
            ts,
            location: data.location ?? "",
            startTime: data.startTime ?? "",
            endTime: data.endTime ?? "",
            menuId: data.menuId ?? "",
            mapsUrl: data.mapsUrl ?? "",
            mapsLabel: data.mapsLabel ?? "",
            mapsProvider: (data.mapsProvider ?? null) as MapProvider | null
          };
        }
      }
      const list = Object.entries(acc)
        .map(([title, v]) => ({
          title,
          last: {
            location: v.location ?? "",
            startTime: v.startTime ?? "",
            endTime: v.endTime ?? "",
            menuId: v.menuId ?? "",
            mapsUrl: v.mapsUrl ?? "",
            mapsLabel: v.mapsLabel ?? "",
            mapsProvider: v.mapsProvider ?? null
          }
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
      setPresets(list);
    });
    return () => unsub();
  }, []);

  // load events for selected date (live)
  useEffect(() => {
    if (!selectedDate) { setEvents([]); return; }
    setLoading(true);
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
      const rows = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((d: any) => d.dateStr === selectedDate) as StationEvent[];
      setEvents(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedDate]);

  // Track event counts per day for red dots (like main page)

  useEffect(() => {
    if (!hasGeoapifyKey || mapsLinkIsManual) {
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsSuggestions([]);
      setMapsLoading(false);
      setShowSuggestionMenu(false);
      return;
    }

    if (skipNextSuggestionFetchRef.current) {
      skipNextSuggestionFetchRef.current = false;
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsLoading(false);
      setShowSuggestionMenu(false);
      return;
    }

    const query = trimmedMapsQuery;
    if (!query) {
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsSuggestions([]);
      setMapsLoading(false);
      setMapsError(null);
      setShowSuggestionMenu(false);
      return;
    }

    if (query.length < GEOAPIFY_MIN_QUERY_LENGTH) {
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsSuggestions([]);
      setMapsLoading(false);
      setMapsError(null);
      setShowSuggestionMenu(false);
      return;
    }

    const controller = new AbortController();
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = controller;
    const requestId = ++suggestionRequestIdRef.current;
    setMapsLoading(true);
    setMapsSuggestions([]);
    setShowSuggestionMenu(true);

    const fetchSuggestions = async () => {
      try {
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Geoapify autocomplete failed: ${response.status}`);
        }
        const data = await response.json();
        if (controller.signal.aborted || suggestionRequestIdRef.current !== requestId) return;

        const features = Array.isArray(data?.features) ? data.features : [];
        const suggestions: MapSuggestion[] = features
          .map((feature: any) => {
            const props = feature?.properties ?? {};
            const geometry = feature?.geometry;
            const lon = typeof props.lon === "number" ? props.lon : geometry?.coordinates?.[0];
            const lat = typeof props.lat === "number" ? props.lat : geometry?.coordinates?.[1];
            if (typeof lat !== "number" || typeof lon !== "number") return null;

            const primary = props.address_line1 || props.name || props.street || props.formatted || "";
            const secondaryParts = [
              props.address_line2,
              props.city,
              props.state_code || props.state,
              props.country
            ].filter(Boolean);
            const secondary = secondaryParts.join(", ") || undefined;
            const id = props.place_id || props.datasource?.raw?.osm_id || `${lat},${lon}`;
            if (!primary || !id) return null;

            return {
              id: String(id),
              label: primary,
              secondary,
              lat,
              lon,
            } as MapSuggestion;
          })
          .filter(Boolean) as MapSuggestion[];

        setMapsSuggestions(suggestions);
        setMapsError(null);
      } catch (err) {
        if (controller.signal.aborted || suggestionRequestIdRef.current !== requestId) {
          return;
        }
        console.warn("[Geoapify]", err);
        setMapsSuggestions([]);
        setMapsError("Unable to fetch location suggestions right now.");
        setShowSuggestionMenu(false);
      } finally {
        if (suggestionRequestIdRef.current === requestId) {
          setMapsLoading(false);
        }
        if (suggestionAbortControllerRef.current === controller) {
          suggestionAbortControllerRef.current = null;
        }
      }
    };

    fetchSuggestions();

    return () => {
      controller.abort();
      if (suggestionAbortControllerRef.current === controller) {
        suggestionAbortControllerRef.current = null;
      }
    };
  }, [trimmedMapsQuery, hasGeoapifyKey, mapsLinkIsManual]);

  useEffect(() => {
    if (mapsLinkIsManual) return;
    if (!mapsCoords) return;
    const nextLink = buildMapLinkForProvider(mapsCoords.lat, mapsCoords.lng, mapProvider);
    if (!nextLink) return;
    setMapsUrl((prev) => (prev === nextLink ? prev : nextLink));
  }, [mapProvider, mapsCoords, mapsLinkIsManual]);

  useEffect(() => {
    if (!mapsCoords) {
      setMapsPreview(null);
      setMapsPreviewMode("none");
      setMapsEmbedInteractive(false);
      return;
    }
    const staticUrl = buildStaticMapUrl(mapsCoords.lat, mapsCoords.lng);
    const embedUrl = buildOpenStreetMapEmbedUrl(mapsCoords.lat, mapsCoords.lng);
    const description = mapsSearchText || location || "Selected location";

    if (staticUrl) {
      setMapsPreview((prev) => {
        if (prev?.src === staticUrl && prev?.embed === embedUrl && prev?.description === description) {
          return prev;
        }
        return {
          src: staticUrl,
          embed: embedUrl,
          description,
        };
      });
      setMapsPreviewMode("image");
      setMapsEmbedInteractive(false);
      return;
    }

    if (embedUrl) {
      setMapsPreview((prev) => {
        if (prev?.embed === embedUrl && prev?.description === description && !prev?.src) {
          return prev;
        }
        return {
          embed: embedUrl,
          description,
        };
      });
      setMapsPreviewMode("embed");
      setMapsEmbedInteractive(false);
      return;
    }

    setMapsPreview(null);
    setMapsPreviewMode("none");
    setMapsEmbedInteractive(false);
  }, [mapsCoords, location, mapsSearchText]);



  // Menu dropdown options and required validation handled in render below

  // Normalize time inputs like "1pm", "130pm", "1:30pm", "13", "1330" into "h:mm AM/PM"
  function normalizeTime(input: string): string {
    const raw = input.trim();
    if (!raw) return "";
    const collapsed = raw.toLowerCase().replace(/\s+/g, ""); // remove all spaces

    // Pattern with optional minutes and am/pm e.g. 1, 1pm, 1:30pm, 01.30pm
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
      // Digits only forms: 130 -> 1:30, 1330 -> 13:30, 900 -> 9:00, 1230 -> 12:30
      if (collapsed.length === 3) {
        hour = parseInt(collapsed.slice(0, 1), 10);
        minute = parseInt(collapsed.slice(1), 10);
      } else { // length 4
        hour = parseInt(collapsed.slice(0, 2), 10);
        minute = parseInt(collapsed.slice(2), 10);
      }
    } else {
      return raw; // give up, return original
    }

    if (hour == null || minute == null || isNaN(hour) || isNaN(minute)) return raw;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return raw;

    if (suffix) {
      // Convert 12-hour input with explicit suffix to canonical
      if (hour < 1 || hour > 12) return raw; // invalid 12-hour hour
      const displayHour = hour; // already 1-12
      const mm = minute.toString().padStart(2, "0");
      return `${displayHour}:${mm} ${suffix}`;
    }

    // Infer AM/PM from 24-hour style
    let inferredSuffix: string;
    let displayHour: number;
    if (hour === 0) {
      inferredSuffix = "AM";
      displayHour = 12; // midnight
    } else if (hour === 12) {
      inferredSuffix = "PM"; // noon
      displayHour = 12;
    } else if (hour > 12) {
      inferredSuffix = "PM";
      displayHour = hour - 12;
    } else { // 1-11
      inferredSuffix = "AM";
      displayHour = hour;
    }
    const mm = minute.toString().padStart(2, "0");
    return `${displayHour}:${mm} ${inferredSuffix}`;
  }

  // Build presets from ALL events (group by title, take most recent by createdAt)
  useEffect(() => {
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
  type Acc = Record<string, { ts: number; location?: string; startTime?: string; endTime?: string; menuId?: string; mapsUrl?: string; mapsLabel?: string; mapsProvider?: MapProvider | null }>;
      const acc: Acc = {};
      for (const d of snap.docs) {
        const data = d.data() as any;
        const t = (data.title ?? "").trim();
        if (!t) continue;
        const ts =
          (data.createdAt?.toMillis?.() ? data.createdAt.toMillis() : 0) ||
          (data._createdAt?.toMillis?.() ? data._createdAt.toMillis() : 0) ||
          0;
        if (!acc[t] || ts >= acc[t].ts) {
          acc[t] = {
            ts,
            location: data.location ?? "",
            startTime: data.startTime ?? "",
            endTime: data.endTime ?? "",
            menuId: data.menuId ?? "",
            mapsUrl: data.mapsUrl ?? "",
            mapsLabel: data.mapsLabel ?? "",
            mapsProvider: (data.mapsProvider ?? null) as MapProvider | null
          };
        }
      }
      const list = Object.entries(acc)
        .map(([title, v]) => ({
          title,
          last: {
            location: v.location ?? "",
            startTime: v.startTime ?? "",
            endTime: v.endTime ?? "",
            menuId: v.menuId ?? "",
            mapsUrl: v.mapsUrl ?? "",
            mapsLabel: v.mapsLabel ?? "",
            mapsProvider: v.mapsProvider ?? null
          }
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
      setPresets(list);
    });
    return () => unsub();
  }, []);

  // load events for selected date (live)
  useEffect(() => {
    if (!selectedDate) { setEvents([]); return; }
    setLoading(true);
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
      const rows = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((d: any) => d.dateStr === selectedDate) as StationEvent[];
      setEvents(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedDate]);

  // Track event counts per day for red dots (like main page)
  const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const [eventsByDate, setEventsByDate] = useState<Record<string, number>>({});
  useEffect(() => {
    async function loadMonth() {
      const { year, month } = currentMonth;
      const snap = await getDocs(collection(db, "events"));
      const counts: Record<string, number> = {};
      snap.forEach((docSnap: any) => {
        const data = docSnap.data() as any;
        const dateStr = data.dateStr;
        if (typeof dateStr === "string" && dateStr.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) {
          counts[dateStr] = (counts[dateStr] || 0) + 1;
        }
      });
      setEventsByDate(counts);
    }
    loadMonth();
  }, [currentMonth]);

  useEffect(() => {
    if (!hasGeoapifyKey || mapsLinkIsManual) {
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsSuggestions([]);
      setMapsLoading(false);
      setShowSuggestionMenu(false);
      return;
    }

    if (skipNextSuggestionFetchRef.current) {
      skipNextSuggestionFetchRef.current = false;
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsLoading(false);
      setShowSuggestionMenu(false);
      return;
    }

    const query = trimmedMapsQuery;
    if (!query) {
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsSuggestions([]);
      setMapsLoading(false);
      setMapsError(null);
      setShowSuggestionMenu(false);
      return;
    }

    if (query.length < GEOAPIFY_MIN_QUERY_LENGTH) {
      suggestionAbortControllerRef.current?.abort();
      suggestionAbortControllerRef.current = null;
      setMapsSuggestions([]);
      setMapsLoading(false);
      setMapsError(null);
      setShowSuggestionMenu(false);
      return;
    }

    const controller = new AbortController();
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = controller;
    const requestId = ++suggestionRequestIdRef.current;
    setMapsLoading(true);
    setMapsSuggestions([]);
    setShowSuggestionMenu(true);

    const fetchSuggestions = async () => {
      try {
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Geoapify autocomplete failed: ${response.status}`);
        }
        const data = await response.json();
        if (controller.signal.aborted || suggestionRequestIdRef.current !== requestId) return;

        const features = Array.isArray(data?.features) ? data.features : [];
        const suggestions: MapSuggestion[] = features
          .map((feature: any) => {
            const props = feature?.properties ?? {};
            const geometry = feature?.geometry;
            const lon = typeof props.lon === "number" ? props.lon : geometry?.coordinates?.[0];
            const lat = typeof props.lat === "number" ? props.lat : geometry?.coordinates?.[1];
            if (typeof lat !== "number" || typeof lon !== "number") return null;

            const primary = props.address_line1 || props.name || props.street || props.formatted || "";
            const secondaryParts = [
              props.address_line2,
              props.city,
              props.state_code || props.state,
              props.country
            ].filter(Boolean);
            const secondary = secondaryParts.join(", ") || undefined;
            const id = props.place_id || props.datasource?.raw?.osm_id || `${lat},${lon}`;
            if (!primary || !id) return null;

            return {
              id: String(id),
              label: primary,
              secondary,
              lat,
              lon,
            } as MapSuggestion;
          })
          .filter(Boolean) as MapSuggestion[];

        setMapsSuggestions(suggestions);
        setMapsError(null);
      } catch (err) {
        if (controller.signal.aborted || suggestionRequestIdRef.current !== requestId) {
          return;
        }
        console.warn("[Geoapify]", err);
        setMapsSuggestions([]);
        setMapsError("Unable to fetch location suggestions right now.");
        setShowSuggestionMenu(false);
      } finally {
        if (suggestionRequestIdRef.current === requestId) {
          setMapsLoading(false);
        }
        if (suggestionAbortControllerRef.current === controller) {
          suggestionAbortControllerRef.current = null;
        }
      }
    };

    fetchSuggestions();

    return () => {
      controller.abort();
      if (suggestionAbortControllerRef.current === controller) {
        suggestionAbortControllerRef.current = null;
      }
    };
  }, [trimmedMapsQuery, hasGeoapifyKey, mapsLinkIsManual]);

  useEffect(() => {
    if (mapsLinkIsManual) return;
    if (!mapsCoords) return;
    const nextLink = buildMapLinkForProvider(mapsCoords.lat, mapsCoords.lng, mapProvider);
    if (!nextLink) return;
    setMapsUrl((prev) => (prev === nextLink ? prev : nextLink));
  }, [mapProvider, mapsCoords, mapsLinkIsManual]);

  useEffect(() => {
    if (!mapsCoords) {
      setMapsPreview(null);
      setMapsPreviewMode("none");
      setMapsEmbedInteractive(false);
      return;
    }
    const staticUrl = buildStaticMapUrl(mapsCoords.lat, mapsCoords.lng);
    const embedUrl = buildOpenStreetMapEmbedUrl(mapsCoords.lat, mapsCoords.lng);
    const description = mapsSearchText || location || "Selected location";

    if (staticUrl) {
      setMapsPreview((prev) => {
        if (prev?.src === staticUrl && prev?.embed === embedUrl && prev?.description === description) {
          return prev;
        }
        return {
          src: staticUrl,
          embed: embedUrl,
          description,
        };
      });
      setMapsPreviewMode("image");
      setMapsEmbedInteractive(false);
      return;
    }

    if (embedUrl) {
      setMapsPreview((prev) => {
        if (prev?.embed === embedUrl && prev?.description === description && !prev?.src) {
          return prev;
        }
        return {
          embed: embedUrl,
          description,
        };
      });
      setMapsPreviewMode("embed");
      setMapsEmbedInteractive(false);
      return;
    }

    setMapsPreview(null);
    setMapsPreviewMode("none");
    setMapsEmbedInteractive(false);
  }, [mapsCoords, location, mapsSearchText]);

  function handleSelectSuggestion(suggestion: MapSuggestion) {
    skipNextSuggestionFetchRef.current = true;
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = null;
    setMapsError(null);
    setMapsSuggestions([]);
    setMapsLoading(false);
    setShowSuggestionMenu(false);
    setMapsLinkIsManual(false);

    const displayLabel = suggestion.secondary
      ? `${suggestion.label}, ${suggestion.secondary}`
      : suggestion.label;
    setMapsSearchText(displayLabel);
    const coords: MapCoords = { lat: suggestion.lat, lng: suggestion.lon };
    setMapsCoords(coords);
    const providerLink = buildMapLinkForProvider(coords.lat, coords.lng, mapProvider);
    setMapsUrl(providerLink || `${coords.lat},${coords.lng}`);
    if (!location.trim()) {
      setLocation(displayLabel);
    }
  }

  function resetForm() {
    setEvId(null);
    setTitle("");
    setLocation("");
    setStartTime("");
    setEndTime("");
    setMenuId("");
    setMapsUrl("");
    setMapsSearchText("");
    setMapsPreview(null);
    setMapsPreviewMode("none");
    setMapsEmbedInteractive(false);
    setMapsError(null);
    setMapsSuggestions([]);
    setMapsLoading(false);
    setMapsCoords(null);
    setMapsLinkIsManual(false);
    setMapProvider(DEFAULT_MAP_PROVIDER);
    setShowSuggestionMenu(false);
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = null;
    skipNextSuggestionFetchRef.current = false;
    setPresetTitle("");
    setUseCustom(false);
  }

  // When a preset is chosen, prefill fields from its last-used details
  useEffect(() => {
    if (!presetTitle) return;
    const p = presets.find(p => p.title === presetTitle);
    if (!p) return;
    setUseCustom(false);
    setTitle(p.title);
    setLocation(p.last.location ?? "");
    setStartTime(p.last.startTime ?? "");
    setEndTime(p.last.endTime ?? "");
    setMenuId(p.last.menuId ?? "");
    skipNextSuggestionFetchRef.current = true;
    setMapsSuggestions([]);
    setMapsLoading(false);
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = null;
    setMapsError(null);

    const presetMaps = p.last.mapsUrl ?? "";
    const presetLabel = p.last.mapsLabel ?? "";
    const presetProvider = (p.last.mapsProvider as MapProvider | null) ?? detectMapProvider(presetMaps);
    const coords = presetMaps ? extractLatLngFromUrl(presetMaps) : null;
    const hasAutoProvider = Boolean(coords && presetProvider);

    setMapsCoords(coords ?? null);
    setMapProvider(presetProvider ?? DEFAULT_MAP_PROVIDER);
    setMapsLinkIsManual(!hasAutoProvider);
    const appliedUrl = hasAutoProvider && coords && presetProvider
      ? buildMapLinkForProvider(coords.lat, coords.lng, presetProvider)
      : presetMaps;
    setMapsUrl(appliedUrl);
    setMapsSearchText(presetLabel || presetMaps || p.last.location || "");
    setShowSuggestionMenu(false);
  }, [presetTitle, presets]);

  async function createEvent() {
    if (!selectedDate) return;
    // must pick a preset OR switch to custom
      setEventError("");
      setEventSuccess("");
      if (!selectedDate) {
        setEventError("Please select a date.");
        return;
      }
      if (!useCustom && !presetTitle) {
        setEventError("Please select a preset or switch to custom mode.");
        return;
      }
      if (useCustom) {
        const missingFields: string[] = [];
        if (!title.trim()) missingFields.push("Event Title");
        if (!location.trim()) missingFields.push("Location");
        if (!startTime.trim()) missingFields.push("Start Time");
        if (!endTime.trim()) missingFields.push("End Time");
        if (!menuId) missingFields.push("Menu");
        if (missingFields.length > 0) {
          setEventError("Please fill out: " + missingFields.join(", "));
          return;
        }
      }
      try {
        const normalizedStart = normalizeTime(startTime.trim());
        const normalizedEnd = normalizeTime(endTime.trim());
        await addDoc(collection(db, "events"), {
          dateStr: selectedDate,
          title: title.trim(),
          location: location.trim(),
          startTime: normalizedStart,
          endTime: normalizedEnd,
          menuId: menuId,
          mapsUrl: mapsUrl.trim(),
          mapsLabel: mapsUrl.trim() ? mapsSearchText.trim() : "",
          mapsProvider: !mapsLinkIsManual && mapsCoords ? mapProvider : null,
          mapsCoords: mapsCoords ? { lat: mapsCoords.lat, lng: mapsCoords.lng } : null,
          createdAt: serverTimestamp(),
        });
        setEventSuccess("Event added successfully!");
        resetForm();
        // Refresh event counts for calendar dots
        if (typeof window !== "undefined") {
          setCurrentMonth({ year: new Date().getFullYear(), month: new Date().getMonth() });
        }
      } catch (err: any) {
        setEventError("Failed to add event: " + (err?.message || "Unknown error"));
      }
  }

  async function startEdit(id: string) {
    setEvId(id);
    const snap = await getDoc(doc(db, "events", id));
    if (!snap.exists()) return;
    const d = snap.data() as any;
    // Editing switches to "custom" mode
    setUseCustom(true);
    setPresetTitle("");
    setTitle(d.title ?? "");
    setLocation(d.location ?? "");
    setStartTime(d.startTime ?? "");
    setEndTime(d.endTime ?? "");
    setMenuId(d.menuId ?? "");
    skipNextSuggestionFetchRef.current = true;
    setMapsSuggestions([]);
    setMapsLoading(false);
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = null;
    setMapsError(null);

    const existingMapsUrl = d.mapsUrl ?? "";
    const existingMapsLabel = d.mapsLabel ?? "";
    const storedProvider = (d.mapsProvider ?? null) as MapProvider | null;
    const derivedProvider = detectMapProvider(existingMapsUrl);
    const coords = existingMapsUrl ? extractLatLngFromUrl(existingMapsUrl) : null;
    const provider = storedProvider || derivedProvider || DEFAULT_MAP_PROVIDER;
    const isManual = !coords || !storedProvider;
    setMapsCoords(coords ?? null);
    setMapProvider(provider);
    setMapsLinkIsManual(isManual);
    const effectiveUrl = !isManual && coords
      ? buildMapLinkForProvider(coords.lat, coords.lng, provider)
      : existingMapsUrl;
    setMapsUrl(effectiveUrl);
    setMapsSearchText(existingMapsLabel || existingMapsUrl || d.location || "");
    setShowSuggestionMenu(false);
  }

  async function saveEdit() {
    if (!evId) return;
    const normalizedStart = normalizeTime(startTime.trim());
    const normalizedEnd = normalizeTime(endTime.trim());
    await updateDoc(doc(db, "events", evId), {
      title: title.trim(),
      location: location.trim(),
      startTime: normalizedStart,
      endTime: normalizedEnd,
      menuId: menuId || "",
      mapsUrl: mapsUrl.trim(),
      mapsLabel: mapsUrl.trim() ? mapsSearchText.trim() : "",
      mapsProvider: !mapsLinkIsManual && mapsCoords ? mapProvider : null
    });
    resetForm();
  }

  async function deleteEvent(id: string) {
    await deleteDoc(doc(db, "events", id));
    if (evId === id) resetForm();
  }

  // Menu dropdown
  const menuOptions = useMemo(() => {
    return menus.filter(m => m.name === "Default Menu").concat(menus.filter(m => m.name !== "Default Menu"));
  }, [menus]);

  // ---------------- RENDER ----------------
  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="flex flex-col items-center">
        <Calendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          eventsByDate={eventsByDate}
          onMonthChange={(y, m) => setCurrentMonth({ year: y, month: m })}
        />
      </div>

      {/* Preset picker + (optional) custom form */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white max-w-3xl mx-auto w-full">
        <h2 className="text-xl font-semibold mb-4">Add Event</h2>

        {!selectedDate && (
          <div className="text-sm text-black/70 mb-3">
            Pick a date on the calendar first.
          </div>
        )}

        {/* Preset select + toggle for custom */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Reuse an Existing Event</label>
            <select
              className="rounded px-3 py-2 border border-black/20"
              value={presetTitle}
              onChange={e => setPresetTitle(e.target.value)}
              disabled={!selectedDate || useCustom}
            >
              <option value="">— Choose an event —</option>
              {presets.map((p) => (
                <option key={p.title} value={p.title}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-sm underline text-black/70 text-left"
              onClick={() => {
                setUseCustom((prev) => {
                  const next = !prev;
                  if (next) {
                    setPresetTitle("");
                    setTitle("");
                    setLocation("");
                    setStartTime("");
                    setEndTime("");
                    setMenuId("");
                    setMapsUrl("");
                    setMapsSearchText("");
                    setMapsPreview(null);
                    setMapsPreviewMode("none");
                    setMapsEmbedInteractive(false);
                    setMapsError(null);
                    setMapsSuggestions([]);
                    setMapsLoading(false);
                    setMapsCoords(null);
                    setMapsLinkIsManual(false);
                    setMapProvider(DEFAULT_MAP_PROVIDER);
                    setShowSuggestionMenu(false);
                    suggestionAbortControllerRef.current?.abort();
                    suggestionAbortControllerRef.current = null;
                    skipNextSuggestionFetchRef.current = false;
                  }
                  return next;
                });
              }}
              disabled={!selectedDate}
            >
              {useCustom ? "Use an existing event instead" : "Or create a custom event"}
            </button>
          </div>

          {/* We've moved the menu selection to the main form grid */}
        </div>


        {(useCustom || presetTitle) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Event Title</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event title"
                disabled={!selectedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Location</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Location"
                disabled={!selectedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Start Time</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                onBlur={() => setStartTime(prev => normalizeTime(prev))}
                placeholder="e.g., 1pm, 1:30pm, 13:30"
                disabled={!selectedDate}
              />
              <p className="text-xs text-black/50">You can type "1pm", "130pm", "1:30 pm", "13", or "1330". It will auto-format.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">End Time</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                onBlur={() => setEndTime(prev => normalizeTime(prev))}
                placeholder="e.g., 2pm, 2:15pm, 14:15"
                disabled={!selectedDate}
              />
              <p className="text-xs text-black/50">Same shorthand supported; we'll normalize automatically.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Menu <span className="text-red-800">*</span></label>
              <select
                className="rounded px-3 py-2 border border-black/20"
                value={menuId}
                onChange={e => setMenuId(e.target.value)}
                disabled={!selectedDate}
                required
              >
                {menus.filter(m => m.name === "Default Menu").map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id}
                  </option>
                ))}
                {menus.filter(m => m.name !== "Default Menu").map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm text-black/70">Map Location Search</label>
              <div className="relative">
                <input
                  ref={mapsInputRef}
                  className="w-full rounded px-3 py-2 border border-black/20"
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
                      suggestionAbortControllerRef.current?.abort();
                      suggestionAbortControllerRef.current = null;
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
                      setShowSuggestionMenu(hasGeoapifyKey && trimmed.length >= GEOAPIFY_MIN_QUERY_LENGTH);
                    }
                  }}
                  onFocus={() => {
                    if (!mapsLinkIsManual && hasGeoapifyKey && trimmedMapsQuery.length >= GEOAPIFY_MIN_QUERY_LENGTH) {
                      setShowSuggestionMenu(true);
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowSuggestionMenu(false), 120);
                  }}
                  placeholder="Search for an address or paste a map link"
                  disabled={!selectedDate}
                  autoComplete="off"
                />
                {hasGeoapifyKey && showSuggestionMenu && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1">
                    {mapsLoading ? (
                      <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-black/60">
                        Searching...
                      </div>
                    ) : mapsSuggestions.length > 0 ? (
                      <ul className="max-h-60 overflow-auto rounded-lg border border-black/10 bg-white shadow-lg">
                        {mapsSuggestions.map((suggestion) => (
                          <li key={suggestion.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-black/5"
                              onMouseDown={(evt) => {
                                evt.preventDefault();
                                handleSelectSuggestion(suggestion);
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
                      <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-black/60">
                        No matches found for "{trimmedMapsQuery}".
                      </div>
                    )}
                  </div>
                )}
              </div>
              {mapsCoords && !mapsLinkIsManual && (
                <div className="flex flex-col gap-1 text-xs text-black/70">
                  <label className="font-medium">Open map with</label>
                  <select
                    className="rounded px-3 py-2 border border-black/20 text-sm text-black"
                    value={mapProvider}
                    onChange={(event) => {
                      const nextProvider = event.target.value as MapProvider;
                      setMapProvider(nextProvider);
                    }}
                  >
                    {MAP_PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {mapsLinkIsManual && mapsUrl && (
                <p className="text-xs text-black/60">
                  Using a custom map link. Select a suggestion above to switch back to provider-generated links.
                </p>
              )}
              {mapsError && (
                <p className="text-xs text-red-800">{mapsError}</p>
              )}
              {!hasGeoapifyKey && !mapsError && (
                <p className="text-xs text-black/60">
                  Add <code>NEXT_PUBLIC_GEOAPIFY_API_KEY</code> to enable autocomplete and map previews.
                </p>
              )}
              {mapsPreviewMode === "image" && mapsPreview?.src && mapsUrl && (
                <div className="mt-2 rounded-lg border border-black/15 bg-black/[0.02] p-3 text-xs text-black/70">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Open in Google Maps ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!evId ? (
            <button
              onClick={createEvent}
              disabled={
                !selectedDate ||
                (!useCustom && !presetTitle) ||
                (useCustom && (!title.trim() || !location.trim() || !startTime.trim() || !endTime.trim() || !menuId))
              }
              className="rounded bg-red-800 text-white px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
            >
              Add Event
            </button>
          ) : (
            <>
              <button
                onClick={saveEdit}
                className="rounded bg-red-800 text-white px-4 py-2 font-medium hover:opacity-90"
              >
                Save
              </button>
              <button
                onClick={() => resetForm()}
                className="rounded bg-black/10 px-4 py-2 font-medium hover:bg-black/20"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

        {/* Event creation feedback */}
        {eventError && (
          <div className="mt-2 text-red-800 font-semibold">{eventError}</div>
        )}
        {eventSuccess && (
          <div className="mt-2 text-green-600 font-semibold">{eventSuccess}</div>
        )}

      {/* Event list for selected date */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white max-w-3xl mx-auto w-full">
        <h2 className="text-xl font-semibold mb-3">
          {selectedDate ? `Events on ${selectedDate}` : "Pick a date to view events"}
        </h2>
        {selectedDate && loading && <div className="text-black/60">Loading…</div>}
        {selectedDate && !loading && events.length === 0 && (
          <div className="text-black/60">No events for this date.</div>
        )}
        <ul className="divide-y divide-black/10">
          {events.map((ev) => (
            <li key={ev.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium">
                  {ev.title} <span className="text-black/60">• {ev.startTime} – {ev.endTime}</span>
                </div>
                <div className="text-sm text-black/70">
                  📍 {ev.location || "No location"}
                  {ev.menuId ? ` • Menu: ${menuMap.get(ev.menuId) ?? ev.menuId}` : ""}
                  {ev.mapsUrl && (
                    <span> • <a href={ev.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-red-800 hover:underline">View on Maps 🗺️</a></span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(ev.id)} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">
                  Edit
                </button>
                <button onClick={() => deleteEvent(ev.id)} className="rounded bg-red-800 text-white px-3 py-1 hover:opacity-90">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
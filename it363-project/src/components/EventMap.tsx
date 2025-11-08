"use client";

import { useEffect, useMemo, useState } from "react";
import type { StationEvent } from "@/components/EventList";

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || "";

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

function buildGeoapifyStaticUrl(lat: number, lon: number) {
  if (!GEOAPIFY_API_KEY) return "";
  const url = new URL("https://maps.geoapify.com/v1/staticmap");
  url.searchParams.set("style", "osm-bright-smooth");
  url.searchParams.set("width", "600");
  url.searchParams.set("height", "400");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("center", `lonlat:${lon},${lat}`);
  url.searchParams.set("marker", `lonlat:${lon},${lat};color:%23dd2c00;size:large`);
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

export default function EventMap({ event }: { event: StationEvent | null }) {
  const mapLabel = event?.mapsLabel || event?.location || "Event location";
  const mapLink = event?.mapsUrl || "";

  const coords = useMemo(() => {
    if (!mapLink) return null;
    return extractLatLngFromUrl(mapLink);
  }, [mapLink]);

  const staticMap = useMemo(() => {
    if (!coords) return "";
    return buildGeoapifyStaticUrl(coords.lat, coords.lng);
  }, [coords]);

  const osmEmbed = useMemo(() => {
    if (!coords) return "";
    return buildOpenStreetMapEmbedUrl(coords.lat, coords.lng);
  }, [coords]);

  type PreviewMode = "image" | "embed" | "link" | "none";
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => {
    if (staticMap) return "image";
    if (osmEmbed) return "embed";
    if (mapLink) return "link";
    return "none";
  });

  useEffect(() => {
    if (staticMap) {
      setPreviewMode("image");
      return;
    }
    if (osmEmbed) {
      setPreviewMode("embed");
      return;
    }
    if (mapLink) {
      setPreviewMode("link");
      return;
    }
    setPreviewMode("none");
  }, [staticMap, osmEmbed, mapLink]);

  const [mapInteractive, setMapInteractive] = useState(false);

  useEffect(() => {
    if (previewMode !== "embed") {
      setMapInteractive(false);
    }
  }, [previewMode]);

  if (!event) return null;

  return (
    <section className="w-full max-w-3xl mt-10">
      <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-1 shadow-[0_15px_45px_rgba(0,0,0,0.35)]">
        <div className="rounded-[24px] bg-black/65 px-5 py-6 sm:px-7 sm:py-8 flex flex-col gap-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-200/80">Event Location</p>
              <h3 className="text-2xl font-semibold text-white leading-tight">{mapLabel}</h3>
            </div>
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
              >
                Open Full Map
                <span aria-hidden>↗</span>
              </a>
            )}
          </header>

          {previewMode === "image" && staticMap ? (
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-[22px] border border-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
              <img
                src={staticMap}
                alt={`Map preview for ${mapLabel}`}
                className="h-80 w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onError={() => {
                  if (osmEmbed) {
                    setPreviewMode("embed");
                  } else if (mapLink) {
                    setPreviewMode("link");
                  } else {
                    setPreviewMode("none");
                  }
                }}
              />
              <span className="absolute bottom-3 right-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                View interactive map ↗
              </span>
            </a>
          ) : previewMode === "embed" && osmEmbed ? (
            <div
              className="relative overflow-hidden rounded-[22px] border border-white/10"
              onMouseLeave={() => setMapInteractive(false)}
            >
              {!mapInteractive && (
                <button
                  type="button"
                  onClick={() => setMapInteractive(true)}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-center text-sm font-medium text-white transition hover:bg-black/30"
                  aria-label="Click to enable map interactions"
                >
                  Click to interact with the map
                </button>
              )}
              <iframe
                src={osmEmbed}
                title="OpenStreetMap preview"
                width="100%"
                height="360"
                loading="lazy"
                className="block"
                referrerPolicy="no-referrer"
                style={{ pointerEvents: mapInteractive ? "auto" : "none" }}
              />
            </div>
          ) : previewMode === "link" && mapLink ? (
            <div className="rounded-[22px] border border-dashed border-white/20 bg-white/5 p-6 text-sm text-gray-100">
              <p className="font-semibold text-white">Map preview unavailable</p>
              <p className="mt-2">
                We could not generate an embedded preview, but you can still open the map in a new tab.
              </p>
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/15"
              >
                Open map ↗
              </a>
              {!GEOAPIFY_API_KEY && (
                <p className="mt-4 text-xs text-gray-400">
                  Add <code>NEXT_PUBLIC_GEOAPIFY_API_KEY</code> to enable the embedded preview here.
                </p>
              )}
            </div>
          ) : previewMode === "none" ? (
            <div className="rounded-[22px] border border-dashed border-white/15 bg-white/5 p-6 text-sm text-gray-300">
              No map has been added for this event yet.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

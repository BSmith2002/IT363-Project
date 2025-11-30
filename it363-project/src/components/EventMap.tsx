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
  if (!event || !event.mapsUrl) return null;

  // Extract coordinates from the event's mapsUrl
  const coords = extractLatLngFromUrl(event.mapsUrl);
  if (!coords) return null;

  // Build Google Maps embed URL
  const googleEmbedUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`;

  return (
    <section className="w-full max-w-3xl mt-10">
      <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-1 shadow-[0_15px_45px_rgba(0,0,0,0.35)]">
        <div className="rounded-[24px] bg-black/65 px-5 py-6 sm:px-7 sm:py-8 flex flex-col gap-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-800/80">Event Location</p>
              <h3 className="text-2xl font-semibold text-white leading-tight">{event.location || "Event location"}</h3>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            >
              Open in Google Maps
              <span aria-hidden>↗</span>
            </a>
          </header>
          <div className="relative overflow-hidden rounded-[22px] border border-white/10 mt-4">
            <iframe
              src={googleEmbedUrl}
              title="Google Maps preview"
              width="100%"
              height="360"
              loading="lazy"
              className="block"
              referrerPolicy="no-referrer"
              style={{ border: 0 }}
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export type StationEvent = {
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
};

export default function EventList({
  date,
  selectedEventId,
  onSelectEvent,
}: {
  date: string | null;
  selectedEventId: string | null;
  onSelectEvent: (event: StationEvent) => void;
}) {
  const [events, setEvents] = useState<StationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function run() {
      if (!date) return setEvents([]);
      setLoading(true);
      try {
        const q = query(collection(db, "events"), where("dateStr", "==", date));
        const snap = await getDocs(q);
        setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [date]);

  if (!date) return null;

  return (
    <div className="w-full max-w-3xl mt-6 text-white">
      <h2 className="text-xl font-semibold mb-2">Events on {date}</h2>
      {loading && <div className="text-gray-400">Loading events…</div>}
      {!loading && events.length === 0 && <div className="text-gray-400">No events for this date.</div>}
      <ul className="space-y-2">
        {events.map((ev) => {
          const active = ev.id === selectedEventId;
          return (
            <li
              key={ev.id}
              className={`rounded border p-3 flex items-center justify-between ${
                active ? "border-red-400 bg-red-50/10" : "border-white/20 bg-white/5"
              }`}
            >
              <div>
                <div className="font-medium">{ev.title}</div>
                <div className="text-sm text-gray-300">
                  📍 {ev.location} • {ev.startTime} – {ev.endTime}
                </div>
              </div>
              <button
                onClick={() => onSelectEvent(ev)}
                className="px-3 py-1 rounded bg-red-700 text-white hover:opacity-90"
              >
                View
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

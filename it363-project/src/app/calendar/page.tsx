"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Calendar from "@/components/Calendar";
import EventList, { type StationEvent } from "@/components/EventList";
import EventMap from "@/components/EventMap";
import MenuView from "@/components/MenuView";

export default function CalendarPage() {
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [todayISO, setTodayISO] = useState<string>(getTodayISO());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<StationEvent | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [eventsByDate, setEventsByDate] = useState<Record<string, number>>({});
  const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });

  // Load events for visible month
  useEffect(() => {
    async function loadMonth() {
      const { year, month } = currentMonth;
      const snap = await getDocs(collection(db, "events"));
      const counts: Record<string, number> = {};
      snap.forEach(docSnap => {
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

  // Auto-select and keep in sync with the current time.
  useEffect(() => {
    let stop = false;
    async function selectBestForToday(forceDate?: string) {
      const nowISO = forceDate ?? getTodayISO();
      if (nowISO !== todayISO) setTodayISO(nowISO);
      if (!selectedDate || selectedDate !== nowISO) return;
      const q = query(collection(db, "events"), where("dateStr", "==", nowISO));
      const snap = await getDocs(q);
      const events: StationEvent[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      if (!events.length || stop) return;
      const parseTime = (t: string): number | null => {
        if (!t) return null;
        const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const min = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        return hour * 60 + min;
      };
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const withWindows = events.map(ev => ({
        ev,
        start: parseTime(ev.startTime),
        end: parseTime(ev.endTime)
      }));
      const ongoing = withWindows.find(w => w.start != null && w.end != null && nowMinutes >= (w.start as number) && nowMinutes <= (w.end as number))?.ev;
      const upcoming = withWindows
        .filter(w => w.start != null && nowMinutes < (w.start as number))
        .sort((a, b) => (a.start as number) - (b.start as number))[0]?.ev;
      const pick = ongoing ?? upcoming ?? events[0];
      setSelectedEventId(pick.id);
      setSelectedEvent(pick);
      setSelectedMenuId(pick.menuId || null);
    }
    selectBestForToday();
    const id = window.setInterval(() => {
      const nowISO = getTodayISO();
      if (selectedDate !== nowISO) {
        setSelectedDate(nowISO);
        setSelectedEventId(null);
        setSelectedEvent(null);
        setSelectedMenuId(null);
      }
      selectBestForToday(nowISO);
    }, 60_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [selectedDate]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-10 shadow-xl shadow-black/10 backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.25),transparent_60%)]" aria-hidden="true" />
          <div className="relative text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-red-700">Find the truck</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-neutral-900">Where we&apos;re serving next</h1>
            <p className="mt-4 text-neutral-700">
              Select a date to see our location, serving window, and the menu tied to that stop.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-neutral-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100/80 px-4 py-2 text-red-700">
                <span className="text-lg">📍</span>
                Live locations updated daily
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-4 py-2 text-amber-700">
                <span className="text-lg">🕒</span>
                Lunch & dinner slots
              </span>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-black/10 backdrop-blur sm:p-10">
          <div className="flex flex-col items-center gap-10">
            <Calendar
              selectedDate={selectedDate}
              eventsByDate={eventsByDate}
              onMonthChange={(y, m) => setCurrentMonth({ year: y, month: m })}
              onSelect={(d) => {
                setSelectedDate(d);
                setSelectedEventId(null);
                setSelectedEvent(null);
                setSelectedMenuId(null);
              }}
            />
            <EventList
              date={selectedDate}
              selectedEventId={selectedEventId}
              onSelectEvent={(event) => {
                setSelectedEventId(event.id);
                setSelectedEvent(event);
                setSelectedMenuId(event.menuId);
              }}
            />
            {selectedEvent && <EventMap event={selectedEvent} />}
            <MenuView menuId={selectedMenuId} />
          </div>
        </section>
      </div>
    </div>
  );
}

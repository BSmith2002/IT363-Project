"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Calendar from "@/components/Calendar";
import EventList, { type StationEvent } from "@/components/EventList";
import EventMap from "@/components/EventMap";
import MenuView from "@/components/MenuView";

export default function ClientHome() {
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
      // compute month start/end ISO strings
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const startISO = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

      // We don't have range queries by dateStr easily unless stored; so fetch all events for month via naive scan.
      // For simplicity, pull all events and filter client-side (could be optimized with composite index if needed).
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
      // Keep today state current (handles midnight rollover)
      if (nowISO !== todayISO) setTodayISO(nowISO);

      if (!selectedDate || selectedDate !== nowISO) return;
      const q = query(collection(db, "events"), where("dateStr", "==", nowISO));
      const snap = await getDocs(q);
      const events: StationEvent[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      if (!events.length || stop) return;

      // parse times like "10:00 AM" or "2:30 PM"
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

      // Prefer ongoing; else next upcoming; else first
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

    // Run immediately on mount/update
    selectBestForToday();

    // Tick every minute to keep selection aligned with current time
    const id = window.setInterval(() => {
      const nowISO = getTodayISO();
      // If the day rolled over, move the calendar to today
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
    <>
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
      <EventMap event={selectedEvent} />
      <MenuView menuId={selectedMenuId} />
    </>
  );
}

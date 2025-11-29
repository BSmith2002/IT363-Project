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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold mb-6">Event Calendar</h1>
      <div className="w-full max-w-6xl flex flex-col items-center">
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
    </div>
  );
}

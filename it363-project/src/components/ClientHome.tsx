"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Calendar from "@/components/Calendar";
import EventList, { type StationEvent } from "@/components/EventList";
import EventMap from "@/components/EventMap";
import MenuView from "@/components/MenuView";

export default function ClientHome() {
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

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

  // Auto-select an event currently in progress when viewing today's date.
  useEffect(() => {
    async function selectOngoing() {
      if (!selectedDate || selectedDate !== todayISO) return;
      // Fetch all events for today
      const q = query(collection(db, "events"), where("dateStr", "==", selectedDate));
      const snap = await getDocs(q);
      const events: StationEvent[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      if (!events.length) return;

      // Current time in minutes for comparison
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Helper: parse times like "10:00 AM" or "2:30 PM"
      function parseTime(t: string): number | null {
        if (!t) return null;
        const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const min = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        return hour * 60 + min;
      }

      // Find first event whose time window includes now
      const ongoing = events.find(ev => {
        const start = parseTime(ev.startTime);
        const end = parseTime(ev.endTime);
        if (start == null || end == null) return false;
        return nowMinutes >= start && nowMinutes <= end;
      });

      if (ongoing) {
        setSelectedEventId(ongoing.id);
        setSelectedEvent(ongoing);
        setSelectedMenuId(ongoing.menuId || null);
      }
    }
    selectOngoing();
  }, [selectedDate, todayISO]);

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

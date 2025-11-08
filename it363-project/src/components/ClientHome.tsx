"use client";
import { useState } from "react";
import Calendar from "@/components/Calendar";
import EventList, { type StationEvent } from "@/components/EventList";
import EventMap from "@/components/EventMap";
import MenuView from "@/components/MenuView";

export default function ClientHome() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<StationEvent | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  return (
    <>
      <Calendar
        selectedDate={selectedDate}
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

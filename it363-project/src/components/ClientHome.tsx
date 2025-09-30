"use client";
import { useState } from "react";
import Calendar from "@/components/Calendar";
import EventList from "@/components/EventList";
import MenuView from "@/components/MenuView";

export default function ClientHome() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  return (
    <>
      <Calendar
        selectedDate={selectedDate}
        onSelect={(d) => {
          setSelectedDate(d);
          setSelectedEventId(null);
          setSelectedMenuId(null);
        }}
      />
      <EventList
        date={selectedDate}
        selectedEventId={selectedEventId}
        onSelectEvent={(eventId, menuId) => {
          setSelectedEventId(eventId);
          setSelectedMenuId(menuId);
        }}
      />
      <MenuView menuId={selectedMenuId} />
    </>
  );
}

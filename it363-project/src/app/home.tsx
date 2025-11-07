import Header from "@/components/Header";
import Calendar from "@/components/Calendar";
import EventList from "@/components/EventList";
import MenuView from "@/components/MenuView";
import { useState } from "react";

export default function Home() {
  return (
    <div className="min-h-screen">
  <main className="pb-16 px-4 sm:px-6 flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">Our Events</h1>

        <ClientHome />
      </main>
    </div>
  );
}

"use client";
function ClientHome() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  return (
    <>
      <Calendar selectedDate={selectedDate} onSelect={(d) => {
        setSelectedDate(d);
        setSelectedEventId(null);
        setSelectedMenuId(null);
      }} />

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

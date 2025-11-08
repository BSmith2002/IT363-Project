"use client";
import { useMemo, useState, useEffect } from "react";

type Props = {
  selectedDate: string | null;
  onSelect: (iso: string) => void;
  // Optional: map of YYYY-MM-DD -> number of events for that day
  eventsByDate?: Record<string, number>;
  // Optional: notify parent when month changes so it can (re)load events
  onMonthChange?: (year: number, monthIndex: number) => void; // monthIndex: 0-11
};

export default function Calendar({ selectedDate, onSelect, eventsByDate, onMonthChange }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = useMemo(() => new Date(year, month, 1), [year, month]);
  const startWeekday = firstDay.getDay();
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });

  function toISO(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Inform parent when month changes (including initial mount)
  useEffect(() => {
    onMonthChange?.(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  return (
    <div className="w-full max-w-xl bg-white rounded-xl shadow p-4 text-black">
      <div className="flex items-center justify-between">
        <button
          className="px-3 py-1 rounded bg-gray-100"
          onClick={() => {
            const prev = new Date(year, month - 1, 1);
            setYear(prev.getFullYear());
            setMonth(prev.getMonth());
          }}
        >
          ←
        </button>
        <div className="font-semibold">{monthName} {year}</div>
        <button
          className="px-3 py-1 rounded bg-gray-100"
          onClick={() => {
            const next = new Date(year, month + 1, 1);
            setYear(next.getFullYear());
            setMonth(next.getMonth());
          }}
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-3 text-center text-sm">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="py-1 font-medium text-gray-600">{d}</div>
        ))}
        {Array.from({ length: startWeekday }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = toISO(year, month, day);
          const isSelected = selectedDate === iso;
          const eventCount = eventsByDate ? (eventsByDate[iso] || 0) : undefined;
          const hasEvents = typeof eventCount === "number" ? eventCount > 0 : undefined;
          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className={`relative aspect-square rounded border text-sm hover:bg-red-50 ${
                isSelected ? "bg-red-100 border-red-400" : "bg-white"
              } ${
                hasEvents === undefined ? "" : hasEvents ? "" : "opacity-40"
              }`}
            >
              {day}
              {typeof eventCount === "number" && eventCount > 0 && (
                <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5">
                  {Array.from({ length: Math.min(eventCount, 5) }).map((_, idx) => (
                    <span
                      key={idx}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-red-600"
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

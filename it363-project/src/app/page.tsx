

"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Calendar from "@/components/Calendar";
import EventList, { type StationEvent } from "@/components/EventList";
import EventMap from "@/components/EventMap";
import MenuView from "@/components/MenuView";

type FacebookPost = {
  id: string | number;
  text: string;
  date: string;
  image: string | null;
  url?: string;
};

export default function Home() {
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [facebookPosts, setFacebookPosts] = useState<FacebookPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const signatureBites = [
    {
      title: "Smoked Station Burger",
      highlight: "Fan favorite",
      description: "Hand-pattied beef, grilled onions, and our signature sauce on a toasted roll.",
      image: "/phillytemp.jpg"
    },
    {
      title: "Loaded Garlic Fries",
      highlight: "Shareable",
      description: "Seasoned fries tossed in garlic butter with parmesan and herbs.",
      image: "/foodtruck.jpg"
    },
    {
      title: "Buffalo Chicken Wrap",
      highlight: "Spicy kick",
      description: "Crispy chicken, buffalo heat, ranch drizzle, and crunchy veggies.",
      image: "/truckimage.jpg"
    }
  ];

  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [todayISO, setTodayISO] = useState<string>(getTodayISO());

  // Pre-fill event form from query params if present
  function getQueryParams() {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      date: params.get("date"),
      title: params.get("title"),
      location: params.get("location"),
      description: params.get("description"),
      phone: params.get("phone"),
      email: params.get("email")
    };
  }

  const queryPrefill = typeof window !== "undefined" ? getQueryParams() : {};

  const [selectedDate, setSelectedDate] = useState<string | null>(queryPrefill.date || todayISO);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<StationEvent | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [eventsByDate, setEventsByDate] = useState<Record<string, number>>({});
  const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });

  // Fetch Facebook posts
  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch('/api/facebook/posts');
        const data = await response.json();
        if (data.posts && data.posts.length > 0) {
          setFacebookPosts(data.posts);
        } else {
          // Fallback to mock data if API fails
          setFacebookPosts([
            {
              id: 1,
              text: "🎉 We're at the Downtown Market today! Come grab your favorite cheesesteak from 11 AM - 3 PM!",
              date: "2 hours ago",
              image: "/placeholder-truck.jpg"
            },
            {
              id: 2,
              text: "New menu item alert! 🌶️ Try our Spicy Buffalo Chicken Wrap - it's a game changer!",
              date: "1 day ago",
              image: "/placeholder-food.jpg"
            }
          ]);
        }
      } catch (error) {
        console.error('Error fetching Facebook posts:', error);
        // Use fallback data
        setFacebookPosts([
          {
            id: 1,
            text: "Welcome to The Station! Check back soon for our latest updates.",
            date: "Recent",
            image: null
          }
        ]);
      } finally {
        setLoadingPosts(false);
      }
    }
    fetchPosts();
  }, []);

  // Auto-cycle through posts every 5 seconds
  useEffect(() => {
    if (facebookPosts.length === 0) return;
    const interval = setInterval(() => {
      setCurrentPostIndex((prev) => (prev + 1) % facebookPosts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [facebookPosts.length]);

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
        if (!t || typeof t !== "string") return null;
        const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
        if (!match || !match[1] || !match[2] || !match[3]) return null;
        let hour = parseInt(match[1], 10);
        const min = parseInt(match[2], 10);
        if (!match[3]) return null;
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

  // TODO: Pass queryPrefill to event form component if you want to pre-fill more fields
  return (
    <div className="min-h-screen">
      <main className="pb-20 px-4 sm:px-6 flex flex-col items-center">
        <section className="relative w-full max-w-6xl mb-12">
          <div className="relative overflow-hidden rounded-3xl shadow-2xl">
            <img src="/foodtruck.jpg" alt="The Station food truck" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2b0a0a]/90 via-[#871010]/80 to-[#f97316]/70" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(253,186,116,0.4),transparent_55%)]" aria-hidden="true" />
            <div className="relative px-8 py-16 sm:px-12 sm:py-20 lg:px-16">
              <p className="text-sm uppercase tracking-[0.4em] text-amber-200">Rolling since 2021</p>
              <h1 className="mt-4 text-4xl md:text-6xl font-bold text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.45)]">
                The Station Food Truck
              </h1>
              <p className="mt-6 max-w-2xl text-lg md:text-xl text-white/85">
                Central Illinois comfort food, smoked sandwiches, and plenty of smiles. Find us around town or bring the truck straight to your next event.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="/menupage"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-red-800 shadow-lg shadow-black/20 transition hover:bg-amber-50"
                >
                  View today's menu
                </a>
                <a
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/70 bg-white/10 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/20"
                >
                  Book the truck
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-3 text-sm text-white/85">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
                  <span className="text-lg">🔥</span>
                  Slow-smoked favorites
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
                  <span className="text-lg">🚚</span>
                  Pop-ups · Weddings · Corporate lunch
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
                  <span className="text-lg">📍</span>
                  Peoria & beyond
                </span>
              </div>
              <div className="mt-10 grid gap-4 text-sm text-white/85 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg">⏱️</span>
                  <div>
                    <p className="font-semibold">Lunch · Dinner</p>
                    <p>Check schedule for hours</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg">🍟</span>
                  <div>
                    <p className="font-semibold">Fresh & made-to-order</p>
                    <p>Never frozen, always flavorful</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg">☎️</span>
                  <div>
                    <p className="font-semibold">Ready to book?</p>
                    <p>Call (309) 453-6700</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full max-w-6xl mb-12">
          <div className="grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-black/10 backdrop-blur">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-800">1</div>
              <h2 className="mt-4 text-xl font-semibold text-neutral-900">Find us fast</h2>
              <p className="mt-2 text-sm text-neutral-600">Peek at the calendar to see exactly where the truck will park and what time serving starts.</p>
            </article>
            <article className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-black/10 backdrop-blur">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">2</div>
              <h2 className="mt-4 text-xl font-semibold text-neutral-900">Choose your favorites</h2>
              <p className="mt-2 text-sm text-neutral-600">Browse the rotating menu, from smoked meats to wraps and comfort classics, all cooked to order.</p>
            </article>
            <article className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-black/10 backdrop-blur">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-800">3</div>
              <h2 className="mt-4 text-xl font-semibold text-neutral-900">Bring us to you</h2>
              <p className="mt-2 text-sm text-neutral-600">Booking is simple. Tell us about your event and we’ll craft a menu that fits your crowd.</p>
            </article>
          </div>
        </section>

        <section className="w-full max-w-6xl mb-12">
          <div className="rounded-3xl border border-white/60 bg-white/80 shadow-xl shadow-black/10 backdrop-blur">
            <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <div className="flex items-center gap-3 text-[#1877f2]">
                <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900">Fresh off our Facebook</h3>
                  <p className="text-sm text-neutral-600">Live updates, pop-ups, and daily specials.</p>
                </div>
              </div>
              <a
                href="https://www.facebook.com/Thestationfoodtruck/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#1877f2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1666ce]"
              >
                Follow us
              </a>
            </div>

            {loadingPosts ? (
              <div className="h-96 bg-neutral-50 flex items-center justify-center">
                <div className="text-neutral-500">Loading posts…</div>
              </div>
            ) : facebookPosts.length === 0 ? (
              <div className="h-96 bg-neutral-50 flex items-center justify-center">
                <div className="text-neutral-500">No posts available.</div>
              </div>
            ) : (
              <>
                <div className="relative h-96 bg-neutral-50">
                  {facebookPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className={`absolute inset-0 transition-opacity duration-500 ${index === currentPostIndex ? "opacity-100" : "opacity-0"}`}
                    >
                      <div className="h-full flex flex-col md:flex-row">
                        {post.image && (
                          <div className="md:w-1/2 h-48 md:h-full bg-neutral-200">
                            <img
                              src={post.image}
                              alt="Facebook post"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EAdd Image%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>
                        )}
                        <div className={`${post.image ? "md:w-1/2" : "w-full"} flex flex-col justify-center p-8`}
                        >
                          <p className="text-lg text-neutral-800 mb-4 leading-relaxed">{post.text}</p>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                            <span>{post.date}</span>
                            {post.url && (
                              <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#1877f2] font-medium hover:underline"
                              >
                                View on Facebook
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h8m0 0v8m0-8L5 19" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-2 py-4 bg-white/90">
                  {facebookPosts.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPostIndex(index)}
                      className={`h-2 rounded-full transition ${index === currentPostIndex ? "w-10 bg-[#1877f2]" : "w-2 bg-neutral-300"}`}
                      aria-label={`Go to post ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="w-full max-w-6xl mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900">Signature bites</h2>
            <p className="mt-2 text-neutral-600">A few crowd-pleasers you’ll find on rotation.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {signatureBites.map((item) => (
              <article key={item.title} className="flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-lg shadow-black/10 backdrop-blur">
                <div className="h-48 w-full overflow-hidden">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 uppercase tracking-wide">
                    {item.highlight}
                  </span>
                  <h3 className="text-xl font-semibold text-neutral-900">{item.title}</h3>
                  <p className="text-sm text-neutral-600">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="w-full max-w-6xl">
          <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-black/10 backdrop-blur sm:p-10">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-neutral-900">Track the truck</h2>
              <p className="mt-3 text-neutral-600">Pick a date to see where we’re headed and preview the menu for that stop.</p>
            </div>
            <div className="mt-10 flex flex-col items-center gap-10">
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
        </section>
      </main>
    </div>
  );
}

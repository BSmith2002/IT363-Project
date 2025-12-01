"use client";

import MenuView from "@/components/MenuView";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MenuPage() {
  const [defaultMenuId, setDefaultMenuId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Fetch the default menu from Firebase
  useEffect(() => {
    async function fetchDefaultMenu() {
      try {
        setLoading(true);
        const menusCollection = collection(db, "menus");
        const menusSnapshot = await getDocs(menusCollection);
        
        const menus = menusSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Menu ${doc.id}`
        }));
        
        // Auto-select a sensible default:
        // 1) A menu named "Default Menu" (case-insensitive)
        // 2) Otherwise the first menu returned
        if (menus.length > 0) {
          const preferred = menus.find(m => (m.name || "").trim().toLowerCase() === "default menu");
          setDefaultMenuId((preferred ?? menus[0]).id);
        }
      } catch (error) {
        console.error("Error fetching menus:", error);
        setDefaultMenuId("1");
      } finally {
        setLoading(false);
      }
    }

    fetchDefaultMenu();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-10 shadow-xl shadow-black/10 backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.25),transparent_55%)]" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="lg:w-2/3">
              <p className="text-sm uppercase tracking-[0.35em] text-red-700">On the menu</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-neutral-900">Comfort classics from The Station</h1>
              <p className="mt-4 max-w-2xl text-neutral-700">
                Our menu contains our classics, but new options pop up often! We lean into our specialty burgers, hearty wraps, and shareable fries that keep your crowd happy. Explore what we're serving today and keep an eye out for new options at the event!
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-neutral-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100/80 px-4 py-2 text-red-700">
                  <span className="text-lg">🔥</span>
                  Spicy and bold flavors
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-4 py-2 text-amber-700">
                  <span className="text-lg">🍽️</span>
                  Gluten-free accommodations available
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2">
                  <span className="text-lg">🥤</span>
                  Ask about catering and diet options!
                </span>
              </div>
            </div>
            <div className="mt-8 lg:mt-0 lg:w-1/3">
              <div className="rounded-2xl bg-white/90 p-6 shadow-lg shadow-black/10">
                <h2 className="text-lg font-semibold text-neutral-900">Need a custom menu?</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  We tailor menus for weddings, catering, and corporate lunches. Let us know what you&apos;re craving and we&apos;ll build a flavorful lineup.
                </p>
                <a
                  href="/book"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Plan your event
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 flex justify-center">
          {loading ? (
            <div className="rounded-2xl border border-white/60 p-8 text-center text-neutral-500 shadow-lg shadow-black/10 backdrop-blur">
              Loading menu…
            </div>
          ) : defaultMenuId ? (
            <MenuView menuId={defaultMenuId} />
          ) : (
            <div className="rounded-2xl border border-white/60 p-8 text-center shadow-lg shadow-black/10 backdrop-blur">
              <h3 className="text-lg font-semibold text-neutral-900">Menu on the way</h3>
              <p className="mt-2 text-neutral-600">We&apos;re updating options for the next stop. Check back soon!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
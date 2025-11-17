"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  photoUrl?: string; // optional; if absent we'll derive /menu/<id>.jpg
  photoUpdatedAt?: number; // used to bust cache when image is replaced
};

type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

type MenuDoc = {
  id: string;
  name?: string;
  sections?: MenuSection[];
};

export default function MenuView({ menuId }: { menuId: string | null }) {
  const [menu, setMenu] = useState<MenuDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!menuId) {
        setMenu(null);
        setSelectedSectionId(null);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "menus", String(menuId)));
        const loaded = snap.exists() ? ({ id: snap.id, ...(snap.data() as any) }) : null;
        setMenu(loaded);
        if (loaded?.sections?.length) {
          // Try to auto-select "Sandwiches & Wraps" (case insensitive, ignore punctuation)
          const targetTitle = "sandwiches & wraps";
          const found = loaded.sections.find((s: MenuSection) => s.title.trim().toLowerCase() === targetTitle);
          setSelectedSectionId(found ? found.id : loaded.sections[0].id);
        } else {
          setSelectedSectionId(null);
        }
      } catch (e) {
        console.error("[MenuView] Firestore error:", e);
        setMenu(null);
        setSelectedSectionId(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [menuId]);

  // Derived selected section
  const selectedSection = useMemo(() => {
    if (!menu?.sections || !selectedSectionId) return null;
    return menu.sections.find(s => s.id === selectedSectionId) || null;
  }, [menu, selectedSectionId]);

  if (!menuId) return <div className="mt-6 text-center text-gray-600">Please select an event from the dropdown above.</div>;
  if (loading) return <div className="mt-6 text-center text-gray-500">Loading menu…</div>;
  if (!menu) return (
    <div className="mt-6 p-8 bg-white rounded-lg shadow-sm border text-center">
      <h3 className="text-lg font-semibold text-gray-700 mb-2">Menu Coming Soon!</h3>
      <p className="text-gray-600">We're working on adding this menu. Please check back later or try another menu option.</p>
    </div>
  );

  return (
    <div className="w-full max-w-3xl mt-8 text-neutral-900">
      {menu?.name && <h3 className="text-2xl font-bold mb-4"></h3>}

      {/* Section selector */}
      {menu?.sections?.length ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {menu.sections.map(sec => {
            const active = sec.id === selectedSectionId;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition ${active ? "bg-red-600 text-white border-red-600" : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50"}`}
              >
                {sec.title}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-neutral-600">No sections.</div>
      )}

      {/* Selected section items */}
      {selectedSection ? (
        <div className="mb-8">
          <div className="bg-red-600 text-white px-3 py-2 rounded-t-xl font-semibold tracking-wide">
            {selectedSection.title}
          </div>
          <ul className="divide-y divide-neutral-200 rounded-b-xl border border-t-0 border-neutral-200 bg-white">
            {(selectedSection.items ?? []).map(it => {
              // Check if this is the steak philly item (by name or ID)
              const isSteakPhilly = it.name.toLowerCase().includes('steak philly') || it.id === 'phillytemp';
              const imageSrc = it.photoUrl
                ? (it.photoUpdatedAt ? `${it.photoUrl}${it.photoUrl.includes('?') ? '&' : '?'}v=${it.photoUpdatedAt}` : it.photoUrl)
                : (isSteakPhilly ? '/phillytemp.jpg' : `/${it.id}.jpg`);
              const hasImage = !!it.photoUrl || isSteakPhilly;
              
              return (
                <li key={it.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="flex-1 pr-3">
                    <div className="font-semibold uppercase tracking-wide">{it.name}</div>
                    {it.desc && <div className="text-sm text-neutral-600">{it.desc}</div>}
                    {it.price && <div className="text-sm mt-1 font-medium text-neutral-700">${it.price}</div>}
                  </div>
                  {hasImage && (
                    <div className="shrink-0">
                      <img
                        src={imageSrc}
                        alt={it.name}
                        className="h-16 w-16 rounded-lg object-cover ring-1 ring-neutral-200"
                      />
                    </div>
                  )}
                </li>
              );
            })}
            {!selectedSection.items?.length && (
              <li className="p-4 text-sm text-neutral-600">No items in this section yet.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

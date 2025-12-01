"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  photoUrl?: string; // optional; if absent we'll derive /menu/<id>.jpg
  photoUpdatedAt?: number; // used to bust cache when image is replaced
  isSpicy?: boolean;
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
          const targetTitle = "sandwiches & wraps";
          const found = loaded.sections.find((s: MenuSection) => s.title.trim().toLowerCase() === targetTitle);
          setSelectedSectionId(found ? found.id : loaded.sections[0].id);
        } else {
          setSelectedSectionId(null);
        }
        // Do not fetch event location for menu page
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
      {/* Removed Google Maps embed for menu page */}
      {menu?.name && <h3 className="text-2xl font-bold mb-4"></h3>}

      {/* Basket pricing notice */}
      <div className="mb-6 text-center">
        <p className="text-lg font-bold text-neutral-800">
          Baskets come with fries: +$3
        </p>
      </div>

      {/* Section selector */}
      {menu?.sections?.length ? (
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          {menu.sections.map(sec => {
            const active = sec.id === selectedSectionId;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition ${active ? "bg-red-800 text-white border-red-800" : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50"}`}
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
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 p-6 ">
            {(selectedSection.items ?? []).map((it, index) => {
              const imageSrc = it.photoUrl;
              const hasImage = !!it.photoUrl;
              return (
                <li key={it.id} className="flex flex-row items-stretch bg-white border-4 border-red-800 rounded-2xl overflow-hidden shadow-lg w-full min-w-[320px] max-w-[700px] mx-auto">
                  <div className="flex-1 px-4 py-3 flex flex-col">
                    <div>
                      <div className="font-bold text-lg text-black mb-1">
                        {it.isSpicy && <span className="mr-1">🌶️</span>}
                        {it.name}
                      </div>
                      {it.desc && <div className="text-sm text-neutral-800 mb-2">{it.desc}</div>}
                    </div>
                    {it.price && <div className="text-base text-black mt-2">${it.price}</div>}
                  </div>
                  {hasImage && (
                    <div className="flex items-stretch justify-end bg-white w-32 min-h-[80px]">
                      <img
                        src={imageSrc}
                        alt={it.name}
                        className="w-full h-full object-cover rounded-r-2xl"
                        style={{ minHeight: '100%', minWidth: '100%' }}
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
      ) : null}
    </div>
  );
}

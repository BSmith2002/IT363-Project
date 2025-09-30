"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  photoUrl?: string; // optional; if absent we'll derive /menu/<id>.jpg
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

  useEffect(() => {
    async function run() {
      if (!menuId) return setMenu(null);
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "menus", String(menuId)));
        setMenu(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) }) : null);
      } catch (e) {
        console.error("[MenuView] Firestore error:", e);
        setMenu(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [menuId]);

  if (!menuId) return null;
  if (loading) return <div className="mt-6 text-gray-400">Loading menu…</div>;
  if (!menu) return <div className="mt-6 text-gray-400">No menu found.</div>;

  return (
    <div className="w-full max-w-3xl mt-8 text-white">
      {menu.name && <h3 className="text-2xl font-semibold mb-3">{menu.name}</h3>}

      {(menu.sections ?? []).map((section) => (
        <div key={section.id} className="mb-6">
          <div className="bg-red-800 text-white px-3 py-2 rounded-t-xl font-semibold tracking-wide">
            {section.title}
          </div>

          <ul className="divide-y divide-white/10 rounded-b-xl border border-t-0 border-white/10 bg-white/5">
            {(section.items ?? []).map((it) => {
              // for firestor once its implemented and paid
              const initialSrc = it.photoUrl || `/${it.id}.jpg`;

              return (
                <li key={it.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="flex-1 pr-3">
                    <div className="font-semibold uppercase tracking-wide">{it.name}</div>
                    {it.desc && <div className="text-sm text-gray-300">{it.desc}</div>}
                    {it.price && <div className="text-sm mt-1">${it.price}</div>}
                  </div>
              // for firestore once its implemented and paid
                  <div className="shrink-0">
                    <img
                      src={initialSrc}
                      alt={it.name}
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/20"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.onerror = null; // prevent infinite loop
                        img.src = "/phillytemp.jpg";
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// src/components/AdminDashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, getDoc
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Calendar from "@/components/Calendar";

// ---------- Types ----------
type StationEvent = {
  id: string;
  dateStr: string;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  menuId: string;
  mapsUrl?: string;
  createdAt?: any;
};

type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  photoUrl?: string;
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
  createdAt?: any;
};

type EventTemplate = {
  id: string;
  title: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  menuId?: string;
};

// ==========================================================
export default function AdminDashboard() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGcpAdmin, setIsGcpAdmin] = useState<boolean>(false);
  const [checkingGcpAccess, setCheckingGcpAccess] = useState<boolean>(true);

  // Tabs - dynamically filter based on GCP admin status
  const ALL_TABS = ["DAYS", "ITEMS", "USERS"] as const;
  const TABS = useMemo(() => {
    return isGcpAdmin ? ALL_TABS : ALL_TABS.filter(t => t !== "USERS");
  }, [isGcpAdmin]);
  type Tab = typeof ALL_TABS[number];
  const [tab, setTab] = useState<Tab>("DAYS");

  // Shared: Menus
  const [menus, setMenus] = useState<MenuDoc[]>([]);
  const menuMap = useMemo(() => new Map(menus.map(m => [m.id, m.name ?? m.id])), [menus]);

  // Check if user is GCP admin
  async function checkGcpAdminStatus() {
    if (!user?.email) {
      setIsGcpAdmin(false);
      setCheckingGcpAccess(false);
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setIsGcpAdmin(false);
        setCheckingGcpAccess(false);
        return;
      }

      // Try to call an admin API that requires GCP privileges
      // We'll use the manage-admin-emails endpoint since it requires GCP access
      const response = await fetch("/api/admin/manage-admin-emails", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`GCP admin check for ${user.email}: ${response.status} ${response.statusText}`);

      // If we get 200, user has GCP admin access
      // If we get 403, user doesn't have GCP admin access but might have regular admin access
      // If we get 401, user isn't authenticated properly
      if (response.ok) {
        console.log(`✅ ${user.email} has GCP admin access`);
        setIsGcpAdmin(true);
      } else if (response.status === 403) {
        // 403 means authenticated but not GCP admin
        console.log(`❌ ${user.email} does not have GCP admin access (403)`);
        setIsGcpAdmin(false);
      } else {
        // Other errors (401, 500, etc.) - assume not GCP admin
        console.log(`❌ ${user.email} GCP admin check failed: ${response.status}`);
        setIsGcpAdmin(false);
      }
    } catch (error) {
      console.warn("Failed to check GCP admin status:", error);
      setIsGcpAdmin(false);
    } finally {
      setCheckingGcpAccess(false);
    }
  }

  // ===== Auth =====
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { email: u.email ?? "" } : null);
    });
  }, []);

  // Check GCP admin status when user changes
  useEffect(() => {
    if (user) {
      setCheckingGcpAccess(true);
      checkGcpAdminStatus();
    } else {
      setIsGcpAdmin(false);
      setCheckingGcpAccess(false);
    }
  }, [user]);

  // Reset tab if user loses access to USERS tab
  useEffect(() => {
    if (!isGcpAdmin && tab === "USERS") {
      setTab("DAYS");
    }
  }, [isGcpAdmin, tab]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setEmail(""); setPass("");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  // Live menus
  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "menus");
    const q = query(ref, orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: MenuDoc[] = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          sections: (data.sections ?? []) as MenuSection[],
          createdAt: data.createdAt
        };
      });
      setMenus(rows);
    });
    return () => unsub();
  }, [user]);

  // ---------------- RENDER ----------------
  return (
    <div className="min-h-screen bg-white text-black px-4 py-10">
      {!user ? (
        <div className="mx-auto w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl">
          <h1 className="text-3xl text-center font-semibold mb-6">Admin Portal</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="User"
              className="w-full rounded-md px-3 py-2 border border-black/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-md px-3 py-2 border border-black/20"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button type="submit" className="w-full rounded-md bg-red-600 text-white py-2 font-medium hover:opacity-90">
              Login
            </button>
          </form>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold">Admin</h1>
              <p className="text-sm text-black/70">
                Signed in as <span className="font-medium">{user.email}</span>
                {!checkingGcpAccess && (
                  <span className={`ml-2 inline-block text-xs px-2 py-0.5 rounded ${
                    isGcpAdmin 
                      ? "bg-green-100 text-green-800" 
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {isGcpAdmin ? "GCP Admin" : "Standard Admin"}
                  </span>
                )}
              </p>
            </div>
            <button onClick={handleLogout} className="rounded bg-red-700 text-white px-3 py-1 hover:opacity-90">
              Sign out
            </button>
          </div>

          {/* Tabs */}
          <div className="sticky top-0 z-10 mb-6 rounded-xl border border-black/10 bg-white/80 backdrop-blur">
            {checkingGcpAccess ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-black/60">Checking permissions...</div>
              </div>
            ) : (
              <div className="flex">
                {TABS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 px-4 py-3 text-center font-medium transition ${
                      tab === t ? "bg-red-700 text-white" : "text-black hover:bg-black/5"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {checkingGcpAccess ? (
            <div className="text-center py-8">
              <div className="text-black/60">Loading...</div>
            </div>
          ) : tab === "DAYS" ? (
            <DaysTab menus={menus} menuMap={menuMap} />
          ) : tab === "ITEMS" ? (
            <ItemsTab menus={menus} />
          ) : tab === "USERS" ? (
            isGcpAdmin ? (
              <UsersTab />
            ) : (
              <div className="text-center py-8">
                <div className="text-red-600 font-medium">Access Denied</div>
                <div className="text-black/60 mt-2">User management requires GCP admin privileges.</div>
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ========================= DAYS TAB =========================
   Choose a template first; if not found, switch to "Custom / New".
   Then submit the event for the selected calendar day.
==============================================================*/
// ========================= DAYS TAB (reuse from existing events) =========================
function DaysTab({
  menus,
  menuMap
}: {
  menus: MenuDoc[];
  menuMap: Map<string, string | undefined>;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<StationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Pull ALL events to build a "preset" list from existing titles (e.g., "Roving Ramble")
  const [presets, setPresets] = useState<
    { title: string; last: Pick<StationEvent, "location"|"startTime"|"endTime"|"menuId"> }[]
  >([]);
  const [presetTitle, setPresetTitle] = useState<string>("");
  const [useCustom, setUseCustom] = useState<boolean>(false);

  // form state (create/edit)
  const [evId, setEvId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [menuId, setMenuId] = useState<string>("");
  const [mapsUrl, setMapsUrl] = useState("");

  // Build presets from ALL events (group by title, take most recent by createdAt)
  useEffect(() => {
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
      type Acc = Record<string, { ts: number; location?: string; startTime?: string; endTime?: string; menuId?: string; mapsUrl?: string }>;
      const acc: Acc = {};
      for (const d of snap.docs) {
        const data = d.data() as any;
        const t = (data.title ?? "").trim();
        if (!t) continue;
        const ts =
          (data.createdAt?.toMillis?.() ? data.createdAt.toMillis() : 0) ||
          (data._createdAt?.toMillis?.() ? data._createdAt.toMillis() : 0) ||
          0;
        if (!acc[t] || ts >= acc[t].ts) {
          acc[t] = {
            ts,
            location: data.location ?? "",
            startTime: data.startTime ?? "",
            endTime: data.endTime ?? "",
            menuId: data.menuId ?? "",
            mapsUrl: data.mapsUrl ?? ""
          };
        }
      }
      const list = Object.entries(acc)
        .map(([title, v]) => ({
          title,
          last: {
            location: v.location ?? "",
            startTime: v.startTime ?? "",
            endTime: v.endTime ?? "",
            menuId: v.menuId ?? ""
          }
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
      setPresets(list);
    });
    return () => unsub();
  }, []);

  // load events for selected date (live)
  useEffect(() => {
    if (!selectedDate) { setEvents([]); return; }
    setLoading(true);
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
      const rows = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((d: any) => d.dateStr === selectedDate) as StationEvent[];
      setEvents(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedDate]);

  function resetForm() {
    setEvId(null);
    setTitle("");
    setLocation("");
    setStartTime("");
    setEndTime("");
    setMenuId("");
    setMapsUrl("");
    setPresetTitle("");
    setUseCustom(false);
  }

  // When a preset is chosen, prefill fields from its last-used details
  useEffect(() => {
    if (!presetTitle) return;
    const p = presets.find(p => p.title === presetTitle);
    if (!p) return;
    setUseCustom(false);
    setTitle(p.title);
    setLocation(p.last.location ?? "");
    setStartTime(p.last.startTime ?? "");
    setEndTime(p.last.endTime ?? "");
    setMenuId(p.last.menuId ?? "");
  }, [presetTitle, presets]);

  async function createEvent() {
    if (!selectedDate) return;
    // must pick a preset OR switch to custom
    if (!useCustom && !presetTitle) return;
    if ((useCustom && !title.trim())) return;

    await addDoc(collection(db, "events"), {
      dateStr: selectedDate,
      title: title.trim(),
      location: location.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      menuId: menuId || "",
      mapsUrl: mapsUrl.trim(),
      createdAt: serverTimestamp(),
    });
    resetForm();
  }

  async function startEdit(id: string) {
    setEvId(id);
    const snap = await getDoc(doc(db, "events", id));
    if (!snap.exists()) return;
    const d = snap.data() as any;
    // Editing switches to "custom" mode
    setUseCustom(true);
    setPresetTitle("");
    setTitle(d.title ?? "");
    setLocation(d.location ?? "");
    setStartTime(d.startTime ?? "");
    setEndTime(d.endTime ?? "");
    setMenuId(d.menuId ?? "");
  }

  async function saveEdit() {
    if (!evId) return;
    await updateDoc(doc(db, "events", evId), {
      title: title.trim(),
      location: location.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      menuId: menuId || ""
    });
    resetForm();
  }

  async function deleteEvent(id: string) {
    await deleteDoc(doc(db, "events", id));
    if (evId === id) resetForm();
  }

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="flex flex-col items-center">
        <Calendar selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {/* Preset picker + (optional) custom form */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white max-w-3xl mx-auto w-full">
        <h2 className="text-xl font-semibold mb-4">Add Event</h2>

        {!selectedDate && (
          <div className="text-sm text-black/70 mb-3">
            Pick a date on the calendar first.
          </div>
        )}

        {/* Preset select + toggle for custom */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Reuse an Existing Event</label>
            <select
              className="rounded px-3 py-2 border border-black/20"
              value={presetTitle}
              onChange={e => setPresetTitle(e.target.value)}
              disabled={!selectedDate || useCustom}
            >
              <option value="">— Choose an event —</option>
              {presets.map((p) => (
                <option key={p.title} value={p.title}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-sm underline text-black/70 text-left"
              onClick={() => {
                setUseCustom(v => !v);
                if (!useCustom) {
                  setPresetTitle("");
                  setTitle("");
                  setLocation("");
                  setStartTime("");
                  setEndTime("");
                  setMenuId("");
                }
              }}
              disabled={!selectedDate}
            >
              {useCustom ? "Use an existing event instead" : "Or create a custom event"}
            </button>
          </div>

          {/* We've moved the menu selection to the main form grid */}
        </div>


        {(useCustom || presetTitle) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Event Title</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event title"
                disabled={!selectedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Location</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Location"
                disabled={!selectedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Start Time</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                placeholder="e.g., 10:00 AM"
                disabled={!selectedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">End Time</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                placeholder="e.g., 2:00 PM"
                disabled={!selectedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Menu</label>
              <select
                className="rounded px-3 py-2 border border-black/20"
                value={menuId}
                onChange={e => setMenuId(e.target.value)}
                disabled={!selectedDate}
              >
                <option value="">— None —</option>
                {menus.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-black/70">Google Maps Link</label>
              <input
                className="rounded px-3 py-2 border border-black/20"
                value={mapsUrl}
                onChange={e => setMapsUrl(e.target.value)}
                placeholder="e.g., https://goo.gl/maps/..."
                disabled={!selectedDate}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!evId ? (
            <button
              onClick={createEvent}
              disabled={
                !selectedDate ||
                (!useCustom && !presetTitle) ||
                (useCustom && !title.trim())
              }
              className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
            >
              Add Event
            </button>
          ) : (
            <>
              <button
                onClick={saveEdit}
                className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:opacity-90"
              >
                Save
              </button>
              <button
                onClick={() => resetForm()}
                className="rounded bg-black/10 px-4 py-2 font-medium hover:bg-black/20"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Event list for selected date */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white max-w-3xl mx-auto w-full">
        <h2 className="text-xl font-semibold mb-3">
          {selectedDate ? `Events on ${selectedDate}` : "Pick a date to view events"}
        </h2>
        {selectedDate && loading && <div className="text-black/60">Loading…</div>}
        {selectedDate && !loading && events.length === 0 && (
          <div className="text-black/60">No events for this date.</div>
        )}
        <ul className="divide-y divide-black/10">
          {events.map((ev) => (
            <li key={ev.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium">
                  {ev.title} <span className="text-black/60">• {ev.startTime} – {ev.endTime}</span>
                </div>
                <div className="text-sm text-black/70">
                  📍 {ev.location || "No location"}
                  {ev.menuId ? ` • Menu: ${menuMap.get(ev.menuId) ?? ev.menuId}` : ""}
                  {ev.mapsUrl && (
                    <span> • <a href={ev.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">View on Maps 🗺️</a></span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(ev.id)} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">
                  Edit
                </button>
                <button onClick={() => deleteEvent(ev.id)} className="rounded bg-red-700 text-white px-3 py-1 hover:opacity-90">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


/* ========================= ITEMS TAB =========================
   Pick a menu to edit, then add an item with name, desc, price,
   and optional picture URL. (Section picker included to keep your schema.)
==============================================================*/
function ItemsTab({ menus }: { menus: MenuDoc[] }) {
  const [activeMenuId, setActiveMenuId] = useState<string>("");
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [showNewMenuForm, setShowNewMenuForm] = useState(false);
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);

  // New menu draft
  const [menuDraft, setMenuDraft] = useState({ name: "" });
  
  // New section draft
  const [sectionDraft, setSectionDraft] = useState({ title: "" });

  // New item draft
  const [draft, setDraft] = useState<{ name: string; desc: string; price: string; photoUrl: string }>({
    name: "", desc: "", price: "", photoUrl: ""
  });

  const activeMenu = useMemo(() => menus.find(m => m.id === activeMenuId), [menus, activeMenuId]);
  const sections = activeMenu?.sections ?? [];

  useEffect(() => {
    // If menu changes and current section no longer exists, clear it
    if (!sections.find(s => s.id === activeSectionId)) {
      setActiveSectionId(sections[0]?.id ?? "");
    }
  }, [sections, activeSectionId]);

  async function addItem() {
    if (!activeMenuId || !activeSectionId || !draft.name.trim()) return;
    const m = activeMenu; if (!m) return;

    const nextSections = (m.sections ?? []).map(s => {
      if (s.id !== activeSectionId) return s;
      const nextItems = [
        ...s.items,
        {
          id: crypto.randomUUID(),
          name: draft.name.trim(),
          desc: draft.desc.trim() || undefined,
          price: draft.price.trim() || undefined,
          photoUrl: draft.photoUrl.trim() || undefined
        } as MenuItem
      ];
      return { ...s, items: nextItems };
    });

    await updateDoc(doc(db, "menus", activeMenuId), { sections: nextSections });
    setDraft({ name: "", desc: "", price: "", photoUrl: "" });
  }

  return (
    <div className="space-y-8">
      {/* Menu Management */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Manage Menus</h2>
          <button
            onClick={() => setShowNewMenuForm(true)}
            className="rounded bg-red-600 text-white px-3 py-1 hover:opacity-90"
          >
            Create New Menu
          </button>
        </div>

        {/* New Menu Form */}
        {showNewMenuForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-black/10">
            <h3 className="text-lg font-medium mb-3">Create New Menu</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Menu Name"
                className="flex-1 rounded px-3 py-2 border border-black/20"
                value={menuDraft.name}
                onChange={e => setMenuDraft({ name: e.target.value })}
              />
              <button
                onClick={async () => {
                  if (!menuDraft.name.trim()) return;
                  await addDoc(collection(db, "menus"), {
                    name: menuDraft.name.trim(),
                    sections: [],
                    createdAt: serverTimestamp()
                  });
                  setMenuDraft({ name: "" });
                  setShowNewMenuForm(false);
                }}
                className="rounded bg-red-600 text-white px-4 py-2 hover:opacity-90"
              >
                Create Menu
              </button>
              <button
                onClick={() => {
                  setMenuDraft({ name: "" });
                  setShowNewMenuForm(false);
                }}
                className="rounded bg-black/10 px-4 py-2 hover:bg-black/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Menu Selection and Section Management */}
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Select Menu to Edit</label>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded px-3 py-2 border border-black/20"
                value={activeMenuId}
                onChange={(e) => {
                  setActiveMenuId(e.target.value);
                  setActiveSectionId("");
                }}
              >
                <option value="">— Choose a menu —</option>
                {menus.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id}
                  </option>
                ))}
              </select>
              {activeMenuId && (
                <button
                  onClick={async () => {
                    if (!confirm("Delete this menu? This cannot be undone.")) return;
                    await deleteDoc(doc(db, "menus", activeMenuId));
                    setActiveMenuId("");
                  }}
                  className="rounded bg-red-700 text-white px-3 py-1 hover:opacity-90"
                >
                  Delete Menu
                </button>
              )}
            </div>
          </div>

          {activeMenuId && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-black/70">Menu Sections</label>
                  <button
                    onClick={() => setShowNewSectionForm(true)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    + Add New Section
                  </button>
                </div>

                {/* New Section Form */}
                {showNewSectionForm && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-black/10">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Section Title"
                        className="flex-1 rounded px-3 py-2 border border-black/20"
                        value={sectionDraft.title}
                        onChange={e => setSectionDraft({ title: e.target.value })}
                      />
                      <button
                        onClick={async () => {
                          if (!sectionDraft.title.trim()) return;
                          const menu = menus.find(m => m.id === activeMenuId);
                          if (!menu) return;

                          const nextSections = [
                            ...(menu.sections ?? []),
                            {
                              id: crypto.randomUUID(),
                              title: sectionDraft.title.trim(),
                              items: []
                            }
                          ];

                          await updateDoc(doc(db, "menus", activeMenuId), {
                            sections: nextSections
                          });

                          setSectionDraft({ title: "" });
                          setShowNewSectionForm(false);
                        }}
                        className="rounded bg-red-600 text-white px-3 py-1 hover:opacity-90"
                      >
                        Add Section
                      </button>
                      <button
                        onClick={() => {
                          setSectionDraft({ title: "" });
                          setShowNewSectionForm(false);
                        }}
                        className="rounded bg-black/10 px-3 py-1 hover:bg-black/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <select
                  className="rounded px-3 py-2 border border-black/20"
                  value={activeSectionId}
                  onChange={(e) => setActiveSectionId(e.target.value)}
                >
                  <option value="">— Select a section —</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>

                {activeSectionId && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={async () => {
                        const menu = menus.find(m => m.id === activeMenuId);
                        if (!menu) return;

                        const section = menu.sections?.find(s => s.id === activeSectionId);
                        if (!section) return;

                        const newTitle = prompt("Enter new section title:", section.title);
                        if (!newTitle?.trim()) return;

                        const nextSections = menu.sections?.map(s =>
                          s.id === activeSectionId
                            ? { ...s, title: newTitle.trim() }
                            : s
                        );

                        await updateDoc(doc(db, "menus", activeMenuId), {
                          sections: nextSections
                        });
                      }}
                      className="text-sm text-black/70 hover:text-black"
                    >
                      Rename Section
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this section and all its items?")) return;
                        const menu = menus.find(m => m.id === activeMenuId);
                        if (!menu) return;

                        const nextSections = menu.sections?.filter(s => s.id !== activeSectionId) ?? [];
                        await updateDoc(doc(db, "menus", activeMenuId), {
                          sections: nextSections
                        });
                        setActiveSectionId("");
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete Section
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add item */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white">
        {!activeMenuId ? (
          <p className="text-black/70">Choose a menu above to add items.</p>
        ) : sections.length === 0 ? (
          <p className="text-black/70">This menu has no sections yet. Create a section first in your menus editor.</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Add an Item</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-black/70">Name</label>
                <input
                  className="rounded px-3 py-2 border border-black/20"
                  value={draft.name}
                  onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Item name"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-black/70">Price</label>
                <input
                  className="rounded px-3 py-2 border border-black/20"
                  value={draft.price}
                  onChange={e => setDraft(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="e.g., 9.99"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm text-black/70">Description</label>
                <input
                  className="rounded px-3 py-2 border border-black/20"
                  value={draft.desc}
                  onChange={e => setDraft(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="Short description"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm text-black/70">Picture URL (optional)</label>
                <input
                  className="rounded px-3 py-2 border border-black/20"
                  value={draft.photoUrl}
                  onChange={e => setDraft(prev => ({ ...prev, photoUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
                {/* If you later add Firebase Storage, you could add a file input here and upload to get a URL */}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={addItem}
                disabled={!draft.name.trim() || !activeSectionId}
                className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
              >
                Add Item
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
/* ========================= USERS TAB =========================
   Choose a template first; if not found, switch to "Custom / New".
   Then submit the event for the selected calendar day.
==============================================================*/
// ========================= USERS TAB (reuse from existing events) =========================
function UsersTab() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [authUsers, setAuthUsers] = useState<{ uid: string; email?: string; displayName?: string; providerIds: string[]; disabled?: boolean }[]>([]);
  const [loginFailures, setLoginFailures] = useState<Record<string, { attempts: number; disabled?: boolean; lastAttempt?: any }>>({});
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // create auth user fields
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  // info box visibility
  const [showSecurityInfo, setShowSecurityInfo] = useState(true);
  const [showPasswordInfo, setShowPasswordInfo] = useState(true);
  const [showPrivilegesInfo, setShowPrivilegesInfo] = useState(true);


  // load admin emails (Firestore doc: admin/emails)
  async function loadAdminEmails() {
    setLoadingAdmins(true);
    try {
      const ref = doc(db, "admin", "emails");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const emails = Object.values(data)
          .filter((v) => typeof v === "string" && v.includes("@"))
          .map((e) => (e as string).trim().toLowerCase());
        setAdminEmails(emails);
      } else {
        setAdminEmails([]);
      }
    } catch (e) {
      console.warn("Failed to load admin emails", e);
      setAdminEmails([]);
    } finally {
      setLoadingAdmins(false);
    }
  }

  useEffect(() => {
    // keep user in state
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u ? { email: u.email ?? "" } : null);
    });
    loadAdminEmails();
    loadAuthUsers();
    loadLoginFailures();
    
    return () => {
      unsubAuth();
    };
  }, []);

  async function getIdToken() {
    const u = auth.currentUser;
    if (!u) return null;
    try {
      return await u.getIdToken();
    } catch (e) {
      console.warn("Failed to get ID token", e);
      return null;
    }
  }

  async function createAuthUser() {
    setMsg(null);
    const em = createEmail.trim().toLowerCase();
    const pw = createPassword;
    if (!em || !em.includes("@") || !pw) {
      setMsg("Enter valid email and password");
      return;
    }
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); setBusy(false); return; }
      const res = await fetch("/api/admin/manage-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          email: em,
          password: pw,
          displayName: createDisplayName || undefined,
          makeAdmin: false,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || "Failed to create user");
      } else {
        setMsg(`Created user ${j.email} (uid: ${j.uid})`);
        // Optionally reload admin emails list in case you added to allowlist elsewhere
        await loadAdminEmails();
        await loadAuthUsers();
        setCreateEmail(""); setCreatePassword(""); setCreateDisplayName("");
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAuthUser(email: string) {
    if (!confirm(`Delete auth user ${email}? This will remove their account.`)) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); setBusy(false); return; }
      const res = await fetch("/api/admin/manage-user", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ email, removeFromAllowlist: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || "Failed to delete user");
      } else {
        setMsg("Deleted user");
        await loadAdminEmails();
        await loadAuthUsers();
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to delete user");
    } finally {
      setBusy(false);
    }
  }

  async function enableAuthUser(email: string) {
    if (!confirm(`Enable auth user ${email}?`)) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); setBusy(false); return; }
      const res = await fetch("/api/admin/enable-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ email }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || "Failed to enable user");
      } else {
        setMsg("Enabled user and cleared login failure history");
        await loadAuthUsers();
        await loadLoginFailures(); // Refresh login failures data
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to enable user");
    } finally {
      setBusy(false);
    }
  }

  async function disableAuthUser(email: string) {
    if (!confirm(`Disable auth user ${email}? This will prevent them from logging in.`)) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); setBusy(false); return; }
      const res = await fetch("/api/admin/disable-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ email }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || "Failed to disable user");
      } else {
        setMsg("Disabled user");
        await loadAuthUsers();
        await loadLoginFailures(); // Refresh login failures data
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to disable user");
    } finally {
      setBusy(false);
    }
  }

  async function resetUserPassword(email: string) {
    if (!confirm(`Send password reset email to ${email}? They will receive an email with instructions to change their password.`)) return;
    setBusy(true);
    try {
      // Use Firebase client-side method which actually sends emails
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin + '/adminpage', // Redirect back to admin page after reset
        handleCodeInApp: false,
        // Note: Expiration time is set in Firebase Console, not in code
        // Default is 1 hour (3600 seconds)
      });
      setMsg(`Password reset email sent to ${email}. They will receive instructions to change their password.`);
    } catch (e: any) {
      console.error("Password reset error:", e);
      if (e.code === "auth/user-not-found") {
        setMsg("No account found with this email address.");
      } else if (e.code === "auth/invalid-email") {
        setMsg("Please enter a valid email address.");
      } else if (e.code === "auth/too-many-requests") {
        setMsg("Too many password reset attempts. Please try again later.");
      } else {
        setMsg(e?.message || "Failed to send reset email");
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadAuthUsers() {
    setMsg(null);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); return; }
      const res = await fetch("/api/admin/manage-user", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || "Failed to load auth users");
      } else {
        setAuthUsers(j.users ?? []);
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to load auth users");
    }
  }

  async function loadLoginFailures() {
    try {
      const token = await getIdToken();
      if (!token) { 
        console.warn("No ID token for loading login failures"); 
        return; 
      }
      
      const res = await fetch("/api/admin/login-failures", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
      });
      
      const j = await res.json();
      if (!res.ok) {
        console.warn("Failed to load login failures:", j?.error);
      } else {
        setLoginFailures(j.failures || {});
      }
    } catch (e) {
      console.warn("Failed to load login failures:", e);
    }
  }



  async function addAdminEmail() {
    setMsg(null);
    const em = newEmail.trim().toLowerCase();
    if (!em || !em.includes("@")) {
      setMsg("Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); setBusy(false); return; }
      
      const res = await fetch("/api/admin/manage-admin-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ email: em }),
      });
      
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setMsg("Access denied: Only GCP admins can add admin emails");
        } else {
          setMsg(j?.error || "Failed to add admin email");
        }
      } else {
        setNewEmail("");
        await loadAdminEmails();
        setMsg("Added admin email");
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to add admin email");
    } finally {
      setBusy(false);
    }
  }

  async function removeAdminEmail(email: string) {
    if (!confirm(`Remove ${email} from admin allowlist? This action requires GCP admin privileges.`)) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) { setMsg("Not authenticated"); setBusy(false); return; }
      
      const res = await fetch("/api/admin/manage-admin-emails", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ email }),
      });
      
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setMsg("Access denied: Only GCP admins can remove admin emails");
        } else {
          setMsg(j?.error || "Failed to remove admin email");
        }
      } else {
        await loadAdminEmails();
        setMsg("Removed admin email");
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to remove admin email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* System Overview Info Boxes */}
      <div className="space-y-4">
        {showSecurityInfo && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 relative">
            <button
              onClick={() => setShowSecurityInfo(false)}
              className="absolute top-2 right-2 text-blue-600 hover:text-blue-800 text-lg font-bold"
              title="Dismiss this info box"
            >
              ×
            </button>
            <h4 className="text-sm font-semibold text-blue-800 mb-1 pr-6">🔒 Auto-Disable Security</h4>
            <p className="text-xs text-blue-700 mb-2">User accounts are automatically disabled after 3 failed login attempts. Enable button clears failure count and re-enables access.</p>
            <p className="text-xs text-blue-600"><strong>Note:</strong> Firebase also has IP-based rate limiting that triggers after many failed attempts from the same location, separate from our user-specific tracking.</p>
          </div>
        )}

        {showPasswordInfo && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 relative">
            <button
              onClick={() => setShowPasswordInfo(false)}
              className="absolute top-2 right-2 text-green-600 hover:text-green-800 text-lg font-bold"
              title="Dismiss this info box"
            >
              ×
            </button>
            <h4 className="text-sm font-semibold text-green-800 mb-1 pr-6">📧 Password Reset</h4>
            <p className="text-xs text-green-700 mb-1">Password reset emails are sent using Firebase's built-in service. Users can also use the "Forgot Password" link for self-service reset.</p>
            <p className="text-xs text-green-600"><strong>Expiration:</strong> Reset links expire after 1 hour by default.</p>
          </div>
        )}

        {showPrivilegesInfo && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 relative">
            <button
              onClick={() => setShowPrivilegesInfo(false)}
              className="absolute top-2 right-2 text-amber-600 hover:text-amber-800 text-lg font-bold"
              title="Dismiss this info box"
            >
              ×
            </button>
            <h4 className="text-sm font-semibold text-amber-800 mb-1 pr-6">⚠️ Admin Privileges Required</h4>
            <p className="text-xs text-amber-700 mb-1">Some actions require GCP admin privileges: adding/removing admin emails, enabling/disabling users.</p>
            <p className="text-xs text-amber-600"><strong>Access:</strong> Ensure your account has proper Firebase project permissions for user management operations.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 p-5 bg-white max-w-3xl mx-auto w-full">
      {msg && <div className="text-md font-semibold text-red-600 mb-3">{msg}</div>}
        <h2 className="text-xl font-semibold mb-2">Manage Admin Emails</h2>
        <p className="text-sm text-black/70 mb-4">Add or remove emails from the admin allowlist for Google authentication and password login. <strong>Note:</strong> Adding/removing admin emails requires GCP admin privileges.</p>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 rounded px-3 py-2 border border-black/20"
            placeholder="newadmin@example.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            disabled={busy}
          />
          <button 
            onClick={addAdminEmail} 
            disabled={busy} 
            className="rounded bg-red-600 text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
            title="Requires GCP admin privileges"
          >
            Add (GCP)
          </button>
        </div>

        <div>
          <h3 className="font-medium font-semibold mb-2">Allowlist Admin Emails</h3>
          {loadingAdmins ? (
            <div className="text-black/60">Loading…</div>
          ) : adminEmails.length === 0 ? (
            <div className="text-black/60">No admin allowlist configured (empty = unrestricted).</div>
          ) : (
            <ul className="divide-y divide-black/10">
              {adminEmails.map((em) => (
                <li key={em} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-medium">{em}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => removeAdminEmail(em)} 
                      className="rounded bg-red-700 text-white px-3 py-1 hover:opacity-90"
                      title="Requires GCP admin privileges"
                    >
                      Remove (GCP)
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Create auth user */}
        <div>
          <h4 className="text-xl font-semibold mb-4">Create New Auth Password User</h4>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <input
              className="rounded px-4 py-3 border border-black/20 text-sm"
              placeholder="email@domain.com"
              value={createEmail}
              onChange={e => setCreateEmail(e.target.value)}
            />
            <input
              className="rounded px-4 py-3 border border-black/20 text-sm"
              placeholder="Password"
              type="password"
              value={createPassword}
              onChange={e => setCreatePassword(e.target.value)}
            />
            <input
              className="rounded px-4 py-3 border border-black/20 text-sm"
              placeholder="Display name (optional)"
              value={createDisplayName}
              onChange={e => setCreateDisplayName(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button onClick={createAuthUser} disabled={busy} className="rounded-lg bg-red-600 text-white px-6 py-3 hover:opacity-90 w-full sm:w-auto text-sm font-medium">Create Auth User</button>
            <div className="text-sm text-black/60">Please add the email to the allowlist above. Otherwise the user will not be able to log in.</div>
          </div>
        </div>
        {/* Auth users list */}
        <div className="mt-6">
          <h3 className="font-medium font-semibold mb-2">All Auth Users</h3>
          {authUsers.length === 0 ? (
            <div className="text-black/60">No auth users loaded. Click refresh to load.</div>
          ) : (
            <ul className="divide-y divide-black/10">
              {authUsers.map(u => (
                <li key={u.uid} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {u.email ?? <em>No email</em>}
                      {u.disabled ? (
                        <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded bg-yellow-300 text-black">
                          {loginFailures[u.email || ""]?.attempts >= 3 ? "Auto-Disabled" : "Disabled"}
                        </span>
                      ) : (
                        <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">Active</span>
                      )}
                    </div>
                    <div className="text-sm text-black/60">
                      {u.displayName ?? ""} {u.providerIds && u.providerIds.length ? `• ${u.providerIds.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.providerIds.includes('google.com') && (
                      <span className="text-sm text-black/50">Google</span>
                    )}
                    {u.disabled ? (
                      <button 
                        onClick={() => enableAuthUser(u.email ?? "")} 
                        className="rounded bg-green-600 text-white px-3 py-1 hover:opacity-90"
                        disabled={busy}
                        title="Enable user and clear login failure count. Requires GCP admin privileges."
                      >
                        Enable
                      </button>
                    ) : (
                      <button 
                        onClick={() => disableAuthUser(u.email ?? "")} 
                        className="rounded bg-orange-600 text-white px-3 py-1 hover:opacity-90"
                        disabled={busy}
                        title="Manually disable user account. Note: Accounts auto-disable after 3 failed login attempts. Requires GCP admin privileges."
                      >
                        Disable
                      </button>
                    )}
                    {/* Only show reset password for password provider users */}
                    {u.providerIds.includes('password') && (
                      <button 
                        onClick={() => resetUserPassword(u.email ?? "")} 
                        className="rounded bg-blue-600 text-white px-3 py-1 hover:opacity-90"
                        disabled={busy}
                      >
                        Send Reset Email
                      </button>
                    )}
                    <button onClick={() => deleteAuthUser(u.email ?? "")} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">Delete Auth</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={loadAuthUsers} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">Refresh Auth Users</button>
            <button onClick={loadLoginFailures} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">Refresh Login Failures</button>
          </div>
        </div>
      </div>
    </div>
  );
}

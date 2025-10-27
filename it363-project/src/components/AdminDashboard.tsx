// src/components/AdminDashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, getDoc, setDoc
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

  // Tabs
  const TABS = ["DAYS", "ITEMS", "USERS"] as const;
  type Tab = typeof TABS[number];
  const [tab, setTab] = useState<Tab>("DAYS");

  // Shared: Menus
  const [menus, setMenus] = useState<MenuDoc[]>([]);
  const menuMap = useMemo(() => new Map(menus.map(m => [m.id, m.name ?? m.id])), [menus]);

  // ===== Auth =====
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { email: u.email ?? "" } : null);
    });
  }, []);

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
              </p>
            </div>
            <button onClick={handleLogout} className="rounded bg-red-700 text-white px-3 py-1 hover:opacity-90">
              Sign out
            </button>
          </div>

          {/* Tabs */}
          <div className="sticky top-0 z-10 mb-6 rounded-xl border border-black/10 bg-white/80 backdrop-blur">
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
          </div>

          {tab === "DAYS" ? (
            <DaysTab menus={menus} menuMap={menuMap} />
          ) : tab === "ITEMS" ? (
            <ItemsTab menus={menus} />
          ) : (
            <UsersTab />
          )}
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

  // Build presets from ALL events (group by title, take most recent by createdAt)
  useEffect(() => {
    const ref = collection(db, "events");
    const unsub = onSnapshot(ref, (snap) => {
      type Acc = Record<string, { ts: number; location?: string; startTime?: string; endTime?: string; menuId?: string }>;
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
            menuId: data.menuId ?? ""
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

          {/* Menu selection  */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Menu (optional)</label>
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
      {/* Menu picker */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white">
        <h2 className="text-xl font-semibold mb-4">Select Menu to Edit</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Menu</label>
            <select
              className="rounded px-3 py-2 border border-black/20"
              value={activeMenuId}
              onChange={(e) => setActiveMenuId(e.target.value)}
            >
              <option value="">— Choose a menu —</option>
              {menus.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Section</label>
            <select
              className="rounded px-3 py-2 border border-black/20"
              value={activeSectionId}
              onChange={(e) => setActiveSectionId(e.target.value)}
              disabled={!activeMenuId || sections.length === 0}
            >
              {sections.length === 0 ? (
                <option value="">No sections in this menu</option>
              ) : (
                sections.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))
              )}
            </select>
          </div>
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
  const [authUsers, setAuthUsers] = useState<{ uid: string; email?: string; displayName?: string; providerIds: string[] }[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // create auth user fields
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");


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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? { email: u.email ?? "" } : null);
    });
    loadAdminEmails();
    loadAuthUsers();
    return () => unsub();
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

  async function addAdminEmail() {
    setMsg(null);
    const em = newEmail.trim().toLowerCase();
    if (!em || !em.includes("@")) {
      setMsg("Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      const ref = doc(db, "admin", "emails");
      const snap = await getDoc(ref);
      const key = Date.now().toString();
      if (snap.exists()) {
        await updateDoc(ref, { [key]: em });
      } else {
        await setDoc(ref, { [key]: em });
      }
      setNewEmail("");
      await loadAdminEmails();
      setMsg("Added admin email");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function removeAdminEmail(email: string) {
    if (!confirm(`Remove ${email} from admin allowlist?`)) return;
    setBusy(true);
    try {
      const ref = doc(db, "admin", "emails");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setMsg("No admin allowlist found");
        return;
      }
      const data = snap.data() as Record<string, any>;
      const next: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if ((v ?? "").toString().trim().toLowerCase() !== email.trim().toLowerCase()) {
          next[k] = v;
        }
      }
      // overwrite doc with remaining entries (or empty object)
      await setDoc(ref, next);
      await loadAdminEmails();
      setMsg("Removed admin email");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      
      <div className="rounded-2xl border border-black/10 p-5 bg-white max-w-3xl mx-auto w-full">
      {msg && <div className="text-md font-semibold text-red-600 mb-3">{msg}</div>}
        <h2 className="text-xl font-semibold mb-2">Manage Admin Emails</h2>
  <p className="text-sm text-black/70 mb-4">Add or remove emails from the admin allowlist for google authentication and password login(Firestore doc: <code>admin/emails</code>).</p>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 rounded px-3 py-2 border border-black/20"
            placeholder="newadmin@example.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            disabled={busy}
          />
          <button onClick={addAdminEmail} disabled={busy} className="rounded bg-red-600 text-white px-4 py-2 hover:opacity-90">Add</button>
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
                    <button onClick={() => removeAdminEmail(em)} className="rounded bg-red-700 text-white px-3 py-1">Remove</button>
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
                    <div className="font-medium">{u.email ?? <em>No email</em>}</div>
                    <div className="text-sm text-black/60">{u.displayName ?? ""} {u.providerIds && u.providerIds.length ? `• ${u.providerIds.join(", ")}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.providerIds.includes('google.com') && (
                      <span className="text-sm text-black/50">Google</span>
                    )}
                    <button onClick={() => deleteAuthUser(u.email ?? "")} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">Delete Auth</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <button onClick={loadAuthUsers} className="rounded bg-black/10 px-3 py-1 hover:bg-black/20">Refresh Auth Users</button>
          </div>
        </div>
      </div>
    </div>
  );
}

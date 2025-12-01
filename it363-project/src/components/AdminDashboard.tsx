import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, getDoc, getDocs
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Calendar from "@/components/Calendar";
import RequestsTab from "@/components/RequestsTab";
import { DaysTab } from "@/components/DaysTab";
import { ItemsTab } from "@/components/ItemsTab";
import { UsersTab } from "@/components/UsersTab";
import { uploadMenuItemPhoto, deleteMenuItemPhoto } from "@/lib/upload-menu-image";

type MenuDoc = {
  id: string;
  name?: string;
  sections?: any[];
  createdAt?: any;
};

export default function AdminDashboard() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGcpAdmin, setIsGcpAdmin] = useState<boolean>(false);
  const [checkingGcpAccess, setCheckingGcpAccess] = useState<boolean>(true);
  const [tab, setTab] = useState<typeof ALL_TABS[number]>("DAYS");
  const [menus, setMenus] = useState<MenuDoc[]>([]);
  const menuMap = useMemo(() => new Map(menus.map(m => [m.id, m.name ?? m.id])), [menus]);
  type BookingRequest = {
    id: string;
    name: string;
    business: string;
    town: string;
    date: string;
    description: string;
    phone: string;
    email: string;
    createdAt?: any;
  };
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | undefined>(undefined);
  function showToast(msg: string, type?: "success" | "error") {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  }
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "menus"), (snap) => {
      setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bookingRequests"), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as BookingRequest)));
      setRequestsLoading(false);
    });
    return () => unsub();
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
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { email: u.email ?? "" } : null);
    });
  }, []);
  useEffect(() => {
    async function checkGcpAdmin() {
      setCheckingGcpAccess(true);
      if (!user?.email) {
        setIsGcpAdmin(false);
        setCheckingGcpAccess(false);
        return;
      }
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setIsGcpAdmin(false);
          return;
        }

        const token = await currentUser.getIdToken(/* forceRefresh */ true).catch(() => currentUser.getIdToken());
        if (!token) {
          setIsGcpAdmin(false);
          return;
        }

        const res = await fetch("/api/admin/manage-admin-emails", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setIsGcpAdmin(false);
          return;
        }

        const json = await res.json().catch(() => ({}));
        setIsGcpAdmin(Boolean(json?.gcpAdmin));
      } catch (e) {
        console.warn("[AdminDashboard] Unable to determine GCP admin status", e);
        setIsGcpAdmin(false);
      } finally {
        setCheckingGcpAccess(false);
      }
    }
    checkGcpAdmin();
  }, [user]);

  // Tabs
  const ALL_TABS = ["DAYS", "ITEMS", "REQUESTS", "USERS"] as const;
  // Show USERS tab for all admins, but restrict actions if not GCP admin
  const TABS = ALL_TABS;
  // ...existing code...
  // ...existing code...
  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#120707] text-white px-4 py-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#280909] via-[#7b0e0e] to-[#f97316] opacity-75" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(0,0,0,0.35),transparent_60%)]" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-md rounded-3xl border border-white/20 bg-black/45 p-8 shadow-2xl backdrop-blur-md">
          <h1 className="text-3xl text-center font-semibold">Admin Portal</h1>
          <p className="mt-3 text-center text-sm text-white/70">Sign in to manage events and menus.</p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-white/60">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-black focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-white/60">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-black focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>
            {error && <div className="rounded-md bg-red-500/15 px-3 py-2 text-xs text-amber-200">{error}</div>}
            <button type="submit" className="w-full rounded-full bg-amber-400 py-2.5 text-sm font-semibold text-red-900 transition hover:bg-amber-300">
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }
  // Show dashboard if authenticated
  return (
    <div className="min-h-screen bg-[#fdf2e9] text-neutral-900 px-4 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="rounded-3xl border border-white/60 bg-white/90 px-6 py-6 shadow-lg shadow-black/10 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-red-700">Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold">Welcome back, {user.email}</h1>
              <p className="text-sm text-neutral-600">
                Manage daily stops, menu updates, booking requests, and user access from one place.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!checkingGcpAccess && (
                <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold ${
                  isGcpAdmin ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                }`}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {isGcpAdmin ? "GCP Admin" : "Standard Admin"}
                </span>
              )}
              <button onClick={() => signOut(auth)} className="rounded-full bg-red-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="sticky top-6 z-10 rounded-3xl border border-white/60 bg-white/90 shadow-md shadow-black/5 backdrop-blur">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] transition ${
                  tab === t ? "rounded-3xl bg-red-800 text-white shadow-inner" : "text-neutral-600 hover:bg-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {tab === "DAYS" && <DaysTab menus={menus} menuMap={menuMap} />}
        {tab === "ITEMS" && <ItemsTab menus={menus} />}
        {tab === "REQUESTS" && (
          <RequestsTab
            requests={requests}
            loading={requestsLoading}
            showToast={showToast}
            menus={menus}
            menuMap={menuMap}
          />
        )}
        {tab === "USERS" && (
          <div>
            {isGcpAdmin ? (
              <UsersTab />
            ) : (
              <div className="py-10 text-center">
                <div className="text-lg font-semibold text-red-800">Access limited</div>
                <div className="mt-2 text-sm text-neutral-600">User management requires GCP admin privileges.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

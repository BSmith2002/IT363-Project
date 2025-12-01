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
        const ref = doc(db, "admin", "emails");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const values = Object.values(data).map(v => (typeof v === "string" ? v.trim().toLowerCase() : ""));
          if (values.includes(user.email.trim().toLowerCase())) {
            setIsGcpAdmin(true);
          } else {
            setIsGcpAdmin(false);
          }
        } else {
          setIsGcpAdmin(false);
        }
      } catch (e) {
        setIsGcpAdmin(false);
      }
      setCheckingGcpAccess(false);
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
      <div className="min-h-screen bg-white text-black px-4 py-10">
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
            {error && <div className="text-sm text-red-800">{error}</div>}
            <button type="submit" className="w-full rounded-md bg-red-800 text-white py-2 font-medium hover:opacity-90">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }
  // Show dashboard if authenticated
  return (
    <div className="min-h-screen bg-white text-black px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header: Show logged-in user and admin status */}
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
          <button onClick={() => signOut(auth)} className="rounded bg-red-800 text-white px-3 py-1 hover:opacity-90">
            Sign out
          </button>
        </div>
        {/* Tabs */}
        <div className="sticky top-0 z-10 mb-6 rounded-xl border border-black/10 bg-white/80 backdrop-blur">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-3 text-center font-medium transition ${
                  tab === t ? "bg-red-800 text-white" : "text-black hover:bg-black/5"
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
              <div className="text-center py-8">
                <div className="text-red-800 font-medium">Access Denied</div>
                <div className="text-black/60 mt-2">User management requires GCP admin privileges.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function AdminLoginPortal() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  // State for allowed admin emails from Firestore document
  const [allowedAdmins, setAllowedAdmins] = useState<string[]>([]);

  // Fetch admin emails
  useEffect(() => {
    async function fetchAdminEmails() {
      const ref = doc(db, "admin", "emails");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        // Collect all email values from the document
        const emails = Object.values(data)
          .filter(v => typeof v === "string" && v.includes("@"))
          .map(e => e.trim().toLowerCase());
        setAllowedAdmins(emails);
      }
    }
    fetchAdminEmails();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      const userEmail = (u?.email ?? "").trim().toLowerCase();
      if (u && allowedAdmins.length > 0 && !allowedAdmins.includes(userEmail)) {
        setError("You are not authorized to access the admin portal.");
        signOut(auth);
        setUser(null);
      } else {
        setUser(u ? { email: u.email ?? "" } : null);
      }
    });
  }, [allowedAdmins]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setEmail(""); setPass("");
    } catch (e: any) {
      setError(e.message || "Login failed");
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center px-4">
      {!user ? (
        <div className="w-full max-w-md rounded-2xl bg-red-800/95 p-6 shadow-xl">
          <h1 className="text-3xl text-center font-semibold mb-6">Admin Portal</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="User"
              className="w-full rounded-md px-3 py-2 text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-md px-3 py-2 text-black"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
            {error && <div className="text-sm text-yellow-300">{error}</div>}
            <button
              type="submit"
              className="w-full rounded-md bg-red-600 py-2 font-medium hover:opacity-90"
            >
              Login
            </button>
          </form>
          <div className="mt-4 flex flex-col items-center">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full rounded-md bg-blue-300 py-2 font-medium hover:opacity-90 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24"><path fill="#4285F4" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.22l6.93-6.93C36.36 2.34 30.55 0 24 0 14.64 0 6.27 5.7 2.13 14.02l8.06 6.27C12.7 13.16 17.89 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9.02h12.44c-.54 2.92-2.18 5.39-4.64 7.06l7.19 5.59C43.73 37.36 46.1 31.41 46.1 24.5z"/><path fill="#FBBC05" d="M10.19 28.29c-.47-1.41-.74-2.91-.74-4.54s.27-3.13.74-4.54l-8.06-6.27C.73 16.84 0 20.29 0 24c0 3.71.73 7.16 2.13 10.06l8.06-6.27z"/><path fill="#EA4335" d="M24 48c6.55 0 12.36-2.17 16.93-5.93l-7.19-5.59c-2.01 1.35-4.59 2.15-7.74 2.15-6.11 0-11.3-3.66-13.81-8.79l-8.06 6.27C6.27 42.3 14.64 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
              Sign in with Google
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Admin</h1>
            <button
              onClick={handleLogout}
              className="rounded bg-red-700 px-3 py-1 hover:opacity-90"
            >
              Sign out
            </button>
          </div>

          {/* TODO: add admins-only CRUD for Days/Items like your mock */}
          <p className="text-gray-200">
            You are signed in as <span className="font-medium">{user.email}</span>.
          </p>
          <p className="mt-2 text-gray-300">
            From here, build your “Days / Items” tabs and write to Firestore
            collections: <code>events</code> and <code>menus</code>.
          </p>
        </div>
      )}
    </div>
  );
}

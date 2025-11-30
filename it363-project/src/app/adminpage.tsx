"use client";

import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function AdminLoginPortal() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      setError(e.message || "Login failed");
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
              className="w-full rounded-md bg-red-800 py-2 font-medium hover:opacity-90"
            >
              Login
            </button>
          </form>
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Admin</h1>
            <button
              onClick={handleLogout}
              className="rounded bg-red-800 px-3 py-1 hover:opacity-90"
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

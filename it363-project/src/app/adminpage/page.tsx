// src/app/adminpage/page.tsx
"use client";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import AdminDashboard from "@/components/AdminDashboard";
import Link from "next/link";

export default function AdminLoginPortal() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
    const [error, setError] = useState<string | null>(null);

  // Allowlist loaded from Firestore
  const [allowedAdmins, setAllowedAdmins] = useState<string[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  // Fetch admin emails (Firestore doc: admin/emails, values are strings)
  useEffect(() => {
    async function fetchAdminEmails() {
      try {
        const ref = doc(db, "admin", "emails");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const emails = Object.values(data)
            .filter((v) => typeof v === "string" && v.includes("@"))
            .map((e) => e.trim().toLowerCase());
          setAllowedAdmins(emails);
        } else {
          // If the doc doesn't exist, treat as no restrictions.
          setAllowedAdmins([]);
        }
      } catch (e) {
        // If fetching allowlist fails, default to no restrictions but surface a warning
        console.warn("[adminpage] Failed to load admin allowlist:", e);
        setAllowedAdmins([]);
      } finally {
        setLoadingAdmins(false);
      }
    }
    fetchAdminEmails();
  }, []);

  // Keep user in state and enforce allowlist when loaded
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      const emailLower = (u?.email ?? "").trim().toLowerCase();

      // If we have an allowlist and the user is not on it, sign out
      if (u && allowedAdmins.length > 0 && !allowedAdmins.includes(emailLower)) {
        setError("You are not authorized to access the admin portal.");
        await signOut(auth);
        setUser(null);
        return;
      }

      setUser(u ? { email: u.email ?? "" } : null);
    });
  }, [allowedAdmins]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setEmail("");
      setPass("");
      // AdminDashboard will render automatically when user is set
    } catch (e: any) {
      // Handle different Firebase Auth error codes
      const code = e?.code || "";
      console.log("Login error details:", { code, message: e?.message, email });
      
      if (code === "auth/invalid-credential") {
        setError("Invalid email or password");
        // Still register this as a login failure for our custom tracking
      } else if (code === "auth/user-not-found") {
        setError("Invalid email or password"); // Don't reveal that user doesn't exist for security
        // Don't track failures for non-existent users
      } else if (code === "auth/user-disabled") {
        setError("Your account has been disabled by an administrator. Contact an admin to re-enable it.");
        return; // Don't register additional failures for already disabled accounts
      } else if (code === "auth/too-many-requests") {
        setError("Too many login attempts from this IP address. This is Firebase's automatic protection. Please wait 15+ minutes, or try: 1) Use 'Forgot Password' link below, 2) Try from a different network/location, 3) Contact admin if this persists.");
        return; // This is Firebase's IP-based rate limiting, not our user-specific tracking
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.");
        return; // Network issues shouldn't count as login failures
      } else {
        setError(e.message || "Login failed");
      }

      // Register failure with server for credential-related errors only (but not for non-existent users)
      const shouldTrackFailure = (code === "auth/invalid-credential" || code === "auth/wrong-password" || !code) && code !== "auth/user-not-found";
      
      if (shouldTrackFailure && email) {
        try {
          console.log("Registering login failure for:", email);
          const response = await fetch("/api/admin/register-login-failure", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_ACTION_SECRET || "",
            },
            body: JSON.stringify({ email }),
          });
          const result = await response.json();
          console.log("Login failure registration result:", { status: response.status, result });
          
          if (result.message && result.message.includes("not found")) {
            console.log("User not found - not tracking login failures");
          } else if (result.disabled) {
            setError("Too many failed login attempts (3+). Your account has been automatically disabled. Contact an admin to re-enable it.");
            return; // Don't show the original error if account was disabled by our system
          }
        } catch (er) {
          console.warn("Failed to report login failure:", er);
        }
      }
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/user-disabled") {
        setError(
          "Too many failed attempts. Your account is now disabled. Contact an admin"
        );
        return;
      }
      setError(e.message || "Google sign-in failed");
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  // Compute whether we should render the dashboard.
  const authedAndAllowed = useMemo(() => {
    if (!user) return false;
    // If allowlist is empty: no restrictions. If present: user must be included.
    if (allowedAdmins.length === 0) return true;
    const em = (user.email ?? "").trim().toLowerCase();
    return allowedAdmins.includes(em);
  }, [user, allowedAdmins]);

  // While we have a signed-in user but the allowlist is still loading, show a small loader to avoid flicker
  if (user && loadingAdmins && allowedAdmins.length > 0) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#120707] text-white grid place-items-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2b0a0a] via-[#741010] to-[#f97316] opacity-70" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(0,0,0,0.35),transparent_60%)]" aria-hidden="true" />
        <div className="relative animate-pulse rounded-full border border-white/30 px-6 py-3 text-sm uppercase tracking-[0.6em] text-white/80">
          Checking access…
        </div>
      </div>
    );
  }

  // If authenticated and allowed -> render the dashboard inline (Option B)
  if (authedAndAllowed) {
    return <AdminDashboard />;
  }

  // Otherwise show the login UI
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120707] text-white flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-[#280909] via-[#7b0e0e] to-[#f97316] opacity-80" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.45),transparent_60%)]" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-black/40 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-amber-200">Admin access</p>
          <h1 className="mt-3 text-3xl font-semibold">The Station Control</h1>
          <p className="mt-3 text-sm text-white/70">Sign in to manage events, menus, and booking requests.</p>
        </div>
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
          <button
            type="submit"
            className="w-full rounded-full bg-amber-400 py-2.5 text-sm font-semibold text-red-900 transition hover:bg-amber-300"
          >
            Sign in
          </button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full rounded-full bg-white/90 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white"
          >
            Continue with Google
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-white/70">
          <a
            href="/forgot-password"
            className="font-medium text-amber-200 hover:text-white"
          >
            Forgot your password?
          </a>
          <div className="mt-2">
            <Link href="/" className="hover:text-white">Return to site</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

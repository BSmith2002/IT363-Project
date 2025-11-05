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
      <div className="min-h-screen bg-neutral-900 text-white grid place-items-center px-4">
        <div className="animate-pulse opacity-70">Checking access…</div>
      </div>
    );
  }

  // If authenticated and allowed -> render the dashboard inline (Option B)
  if (authedAndAllowed) {
    return <AdminDashboard />;
  }

  // Otherwise show the login UI
  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center px-4">
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
            {/* Simple Google icon (inline SVG) */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">
              <path fill="#4285F4" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.22l6.93-6.93C36.36 2.34 30.55 0 24 0 14.64 0 6.27 5.7 2.13 14.02l8.06 6.27C12.7 13.16 17.89 9.5 24 9.5z"/>
              <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9.02h12.44c-.54 2.92-2.18 5.39-4.64 7.06l7.19 5.59C43.73 37.36 46.1 31.41 46.1 24.5z"/>
              <path fill="#FBBC05" d="M10.19 28.29c-.47-1.41-.74-2.91-.74-4.54s.27-3.13.74-4.54l-8.06-6.27C.73 16.84 0 20.29 0 24c0 3.71.73 7.16 2.13 10.06l8.06-6.27z"/>
              <path fill="#EA4335" d="M24 48c6.55 0 12.36-2.17 16.93-5.93l-7.19-5.59c-2.01 1.35-4.59 2.15-7.74 2.15-6.11 0-11.3-3.66-13.81-8.79l-8.06 6.27C6.27 42.3 14.64 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="mt-4 text-center">
          <a 
            href="/forgot-password"
            className="text-sm text-white/70 hover:text-white underline"
          >
            Forgot your password?
          </a>
        </div>
      </div>
    </div>
  );
}

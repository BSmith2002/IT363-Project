"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(
        `Password reset email sent to ${email}. Please check your inbox and follow the instructions to reset your password.`
      );
      setEmail("");
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many password reset attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to send password reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-red-800/95 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-4 text-center">Reset Your Password</h1>
        
        <p className="text-sm text-white/80 mb-6 text-center">
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              type="email"
              placeholder="Enter your email address"
              className="w-full rounded-md px-3 py-2 text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-yellow-300 bg-red-800/50 p-2 rounded">
              {error}
            </div>
          )}

          {message && (
            <div className="text-sm text-green-300 bg-green-900/50 p-2 rounded">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-red-800 py-2 font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link 
            href="/adminpage"
            className="text-sm text-white/70 hover:text-white underline"
          >
            Back to Admin Login
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link 
            href="/"
            className="text-sm text-white/70 hover:text-white underline"
          >
            Return to Home
          </Link>
        </div>

        <div className="mt-6 text-xs text-white/60">
          <p><strong>Note:</strong> If you don't receive the email within a few minutes:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Check your spam/junk folder</li>
            <li>Make sure you entered the correct email address</li>
            <li>Contact an administrator if you continue to have issues</li>
          </ul>
          <p className="mt-2"><strong>⏰ Important:</strong> Password reset links expire after <strong>1 hour</strong>. Request a new link if yours has expired.</p>
        </div>
      </div>
    </div>
  );
}
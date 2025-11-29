// UsersTab implementation from AdminDashboard.tsx
import { useEffect, useState } from "react";
import { onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

// Full UsersTab implementation from AdminDashboard.tsx
export function UsersTab() {
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

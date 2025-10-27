import { NextResponse } from "next/server";

// Force Node runtime for this handler so the Admin SDK (Node-only) runs correctly
export const runtime = "nodejs";

// Lazy/dynamic import of firebase-admin to avoid Turbopack trying to evaluate
// the native Node-only module at bundle time.
let _admin: any | null = null;

// Initialize admin SDK from service account JSON stored in env var FIREBASE_SERVICE_ACCOUNT
async function initAdmin() {
  if (_admin && _admin.apps && _admin.apps.length) return _admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT env var not set. Provide service account JSON as an env var."
    );
  }

  // Support either raw JSON string or base64-encoded JSON to avoid newline quoting issues.
  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    try {
      // treat as base64
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT does not appear to be JSON or base64-encoded JSON");
    }
  }

  let svc: any;
  try {
    svc = JSON.parse(jsonStr);
    // Some CI/hosted env vars store private_key with escaped newlines ("\\n"); fix that.
    if (svc?.private_key && typeof svc.private_key === "string") {
      svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    }
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON (or base64-encoded JSON)");
  }

  // Dynamic import the admin SDK here (Node runtime required)
  const adminModule = await import("firebase-admin");
  const adm = adminModule?.default ?? adminModule;
  // If an app already exists, reuse it instead of initializing again.
  if (adm.apps && adm.apps.length) {
    _admin = adm;
    return _admin;
  }
  adm.initializeApp({
    credential: adm.credential.cert(svc),
  });
  _admin = adm;
  return _admin;
}

async function verifyCallerIsAdmin(idToken: string) {
  const adm = await initAdmin();
  const decoded = await adm.auth().verifyIdToken(idToken);
  const callerEmail = (decoded.email || "").toLowerCase();

  // load allowlist from Firestore doc admin/emails
  const doc = await adm.firestore().doc("admin/emails").get();
  if (!doc.exists) return true; // no allowlist => unrestricted
  const data = doc.data() || {};
  const emails = Object.values(data)
    .filter((v) => typeof v === "string")
    .map((s) => (s as string).trim().toLowerCase());

  return emails.length === 0 || emails.includes(callerEmail);
}

export async function POST(req: Request) {
  // create user
  try {
    const adm = await initAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await req.json();
    const { email, password, displayName, makeAdmin } = body as {
      email?: string;
      password?: string;
      displayName?: string;
      makeAdmin?: boolean;
    };

    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }

    const user = await adm.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });

    // optionally add to admin allowlist
    if (makeAdmin) {
      const ref = adm.firestore().doc("admin/emails");
      await ref.set({ [Date.now().toString()]: (email || "").toLowerCase() }, { merge: true });
    }

    return NextResponse.json({ uid: user.uid, email: user.email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  // delete user by uid or email
  try {
    const adm = await initAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await req.json();
    const { uid, email, removeFromAllowlist } = body as { uid?: string; email?: string; removeFromAllowlist?: boolean };
    if (!uid && !email) return NextResponse.json({ error: "uid or email required" }, { status: 400 });

    let targetUid = uid;
    if (!targetUid && email) {
      const u = await adm.auth().getUserByEmail(email);
      targetUid = u.uid;
    }

    await adm.auth().deleteUser(targetUid as string);

    if (removeFromAllowlist && email) {
      const ref = adm.firestore().doc("admin/emails");
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() as Record<string, any>;
        const next: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if ((v ?? "").toString().trim().toLowerCase() !== (email || "").trim().toLowerCase()) {
            next[k] = v;
          }
        }
        await ref.set(next);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // list users (limited)
  try {
    const adm = await initAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    // list up to 1000 users
    const list = await adm.auth().listUsers(1000);
    const users = list.users.map((u: any) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      providerIds: (u.providerData || []).map((p: any) => p.providerId),
    }));

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

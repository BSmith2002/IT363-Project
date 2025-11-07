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

// Verify caller by fetching live GCP IAM members (or cache). This ensures the
// current GCP IAM membership is used to authorize admin edits.
async function verifyCallerIsGcpAdmin(idToken: string) {
  const adm = await initAdmin();
  const decoded = await adm.auth().verifyIdToken(idToken);
  const callerEmail = (decoded.email || "").toLowerCase();

  try {
    const { getGcpIamMembers } = await import("../../../../lib/gcp");
    const members = await getGcpIamMembers();
    return Array.isArray(members) && members.includes(callerEmail);
  } catch (e) {
    // If the live check fails (missing creds/permission), deny by default to be safe.
    console.warn("[verifyCallerIsGcpAdmin] failed to fetch GCP IAM members:", e);
    return false;
  }
}

export async function POST(req: Request) {
  // Add admin email - requires GCP admin
  try {
    const adm = await initAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsGcpAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized - requires GCP-synced admin" }, { status: 403 });

    const body = await req.json();
    const { email } = body as { email?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ref = adm.firestore().doc("admin/emails");
    const key = Date.now().toString();
    
    const snap = await ref.get();
    if (snap.exists) {
      await ref.update({ [key]: normalizedEmail });
    } else {
      await ref.set({ [key]: normalizedEmail });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Added ${normalizedEmail} to admin allowlist` 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Check GCP admin status - just returns success/failure for permission checking
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsGcpAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized - requires GCP admin" }, { status: 403 });

    return NextResponse.json({ gcpAdmin: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  // Remove admin email - requires GCP admin
  try {
    const adm = await initAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsGcpAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized - requires GCP-synced admin" }, { status: 403 });

    const body = await req.json();
    const { email } = body as { email?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ref = adm.firestore().doc("admin/emails");
    const snap = await ref.get();
    
    if (!snap.exists) {
      return NextResponse.json({ error: "No admin allowlist found" }, { status: 404 });
    }

    const data = snap.data() as Record<string, any>;
    const next: Record<string, any> = {};
    
    for (const [k, v] of Object.entries(data)) {
      if ((v ?? "").toString().trim().toLowerCase() !== normalizedEmail) {
        next[k] = v;
      }
    }

    // Overwrite doc with remaining entries (or empty object)
    await ref.set(next);

    return NextResponse.json({ 
      success: true, 
      message: `Removed ${normalizedEmail} from admin allowlist` 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
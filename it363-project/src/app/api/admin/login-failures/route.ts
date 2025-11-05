import { NextResponse } from "next/server";

// Run in Node to use the Admin SDK
export const runtime = "nodejs";

let _admin: any | null = null;

async function initAdmin() {
  if (_admin && _admin.apps && _admin.apps.length) return _admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set");
  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    try { jsonStr = Buffer.from(jsonStr, "base64").toString("utf8"); } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT does not appear to be JSON or base64"); }
  }
  let svc: any;
  try {
    svc = JSON.parse(jsonStr);
    if (svc?.private_key && typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON"); }

  const adminModule = await import("firebase-admin");
  const adm = adminModule?.default ?? adminModule;
  if (adm.apps && adm.apps.length) { _admin = adm; return _admin; }
  adm.initializeApp({ credential: adm.credential.cert(svc) });
  _admin = adm;
  return _admin;
}

async function verifyCallerIsAdmin(idToken: string) {
  const adm = await initAdmin();
  const decoded = await adm.auth().verifyIdToken(idToken);
  const callerEmail = (decoded.email || "").toLowerCase();
  const doc = await adm.firestore().doc("admin/emails").get();
  if (!doc.exists) return true;
  const data = doc.data() || {};
  const emails = Object.values(data).filter(v => typeof v === "string").map(s => (s as string).trim().toLowerCase());
  return emails.length === 0 || emails.includes(callerEmail);
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const adm = await initAdmin();
    const snap = await adm.firestore().collection("loginFailures").get();
    
    const failures: Record<string, { attempts: number; disabled?: boolean; lastAttempt?: any }> = {};
    snap.docs.forEach((doc: any) => {
      const data = doc.data();
      // Doc ID is base64 encoded email, decode it
      try {
        const email = Buffer.from(doc.id, "base64").toString("utf8");
        failures[email] = {
          attempts: data.attempts || 0,
          disabled: data.disabled || false,
          lastAttempt: data.lastAttempt
        };
      } catch (e) {
        console.warn("Failed to decode email from doc ID:", doc.id);
      }
    });

    return NextResponse.json({ failures });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
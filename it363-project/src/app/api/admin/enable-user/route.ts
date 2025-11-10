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

async function verifyCallerIsGcpAdmin(idToken: string) {
  const adm = await initAdmin();
  const decoded = await adm.auth().verifyIdToken(idToken);
  const callerEmail = (decoded.email || "").toLowerCase();

  try {
    const { getGcpIamMembers } = await import("../../../../lib/gcp");
    const members = await getGcpIamMembers();
    return Array.isArray(members) && members.includes(callerEmail);
  } catch (e) {
    console.warn("[verifyCallerIsGcpAdmin] failed to fetch GCP IAM members:", e);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  const allowed = await verifyCallerIsGcpAdmin(idToken);
  if (!allowed) return NextResponse.json({ error: "Not authorized - requires GCP-synced admin" }, { status: 403 });

    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const adm = await initAdmin();
    const user = await adm.auth().getUserByEmail(email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await adm.auth().updateUser(user.uid, { disabled: false });

    // Remove any recorded login failures for this email so the account is not immediately re-disabled
    try {
      const id = Buffer.from(email.toLowerCase().trim()).toString("base64");
      await adm.firestore().collection("loginFailures").doc(id).delete();
    } catch (e) {
      // ignore if not found or error
      console.warn("[enable-user] failed to delete loginFailures doc:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

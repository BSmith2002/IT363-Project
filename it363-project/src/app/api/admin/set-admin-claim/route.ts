import { NextResponse } from "next/server";

export const runtime = "nodejs";

let _admin: any | null = null;

async function initAdmin() {
  if (_admin && _admin.apps && _admin.apps.length) return _admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set");

  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
  }
  const svc = JSON.parse(jsonStr);
  if (svc?.private_key && typeof svc.private_key === "string") {
    svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  }

  const adminModule = await import("firebase-admin");
  const adm = (adminModule as any)?.default ?? adminModule;
  if (adm.apps && adm.apps.length) { _admin = adm; return _admin; }
  adm.initializeApp({ credential: adm.credential.cert(svc) });
  _admin = adm;
  return _admin;
}

async function verifyCallerIsGcpAdmin(idToken: string) {
  const adm = await initAdmin();
  try {
    await adm.auth().verifyIdToken(idToken);
  } catch {
    return false;
  }
  try {
    const { getGcpIamMembers } = await import("../../../../lib/gcp");
    const members = await getGcpIamMembers();
    const decoded = await adm.auth().verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    return Array.isArray(members) && members.includes(email);
  } catch (e) {
    console.warn("[set-admin-claim] GCP admin check failed", e);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const adm = await initAdmin();
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

    const allowed = await verifyCallerIsGcpAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await req.json();
    const { email, admin } = body as { email?: string; admin?: boolean };
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const user = await adm.auth().getUserByEmail(email);
    await adm.auth().setCustomUserClaims(user.uid, { admin: admin !== false });

    return NextResponse.json({ uid: user.uid, email: user.email, admin: admin !== false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

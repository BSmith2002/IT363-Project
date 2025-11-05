import { NextResponse } from "next/server";

// Node runtime required for googleapis and firebase-admin
export const runtime = "nodejs";

let _admin: any | null = null;

async function initAdmin() {
  if (_admin && _admin.apps && _admin.apps.length) return _admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set. Provide service account JSON as an env var.");

  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    try {
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT does not appear to be JSON or base64-encoded JSON");
    }
  }

  let svc: any;
  try {
    svc = JSON.parse(jsonStr);
    if (svc?.private_key && typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON (or base64-encoded JSON)");
  }

  const adminModule = await import("firebase-admin");
  const adm = adminModule?.default ?? adminModule;
  if (adm.apps && adm.apps.length) {
    _admin = adm;
    return _admin;
  }
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
  const emails = Object.values(data).filter((v) => typeof v === "string").map((s) => (s as string).trim().toLowerCase());
  return emails.length === 0 || emails.includes(callerEmail);
}

function parseServiceAccount(raw: string) {
  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    try {
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT does not appear to be JSON or base64-encoded JSON");
    }
  }
  const svc = JSON.parse(jsonStr);
  if (svc?.private_key && typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  return svc;
}

export async function GET(req: Request) {
  try {
    const adm = await initAdmin();

    // verify caller
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    const allowed = await verifyCallerIsAdmin(idToken);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    // Load service account for GCP API
    const rawSvc = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
    if (!rawSvc) return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT env var required on server" }, { status: 500 });
    const svc = parseServiceAccount(rawSvc);

    const projectId = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    if (!projectId) return NextResponse.json({ error: "GCP_PROJECT_ID (or NEXT_PUBLIC_FB_PROJECT_ID) env var required" }, { status: 500 });

    const { google } = await import("googleapis");

    // Authenticate to Google Cloud using the provided service account JSON
    const auth = new google.auth.GoogleAuth({ credentials: svc, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const authClient = await auth.getClient();

    const crm = google.cloudresourcemanager({ version: "v3", auth: auth });

    // The API expects the resource to be the project id (string) or project number. Use 'projects/PROJECT_ID' pattern if necessary.
    // We'll call projects.getIamPolicy with the projectId.
    const res = await crm.projects.getIamPolicy({ resource: projectId, requestBody: {} as any });
    const policy = res.data as any;
    const bindings = policy?.bindings || [];
    const members: string[] = [];
    for (const b of bindings) {
      const arr = Array.isArray(b.members) ? b.members : [];
      for (const m of arr) {
        // member strings like 'user:alice@example.com', 'serviceAccount:sa@proj.iam.gserviceaccount.com', 'group:team@example.com'
        const parts = (m || "").toString().split(":");
        if (parts.length >= 2) {
          const kind = parts[0];
          const value = parts.slice(1).join(":");
          // keep user/group/serviceAccount types (these include raw emails)
          if (kind === "user" || kind === "group" || kind === "serviceAccount") {
            members.push(value.toLowerCase());
          }
        }
      }
    }

    // unique
    const uniq = Array.from(new Set(members));

    return NextResponse.json({ members: uniq });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}



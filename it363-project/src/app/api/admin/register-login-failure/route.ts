import { NextResponse } from "next/server";

// Ensure this runs in Node so we can use the Admin SDK
export const runtime = "nodejs";

let _admin: any | null = null;

async function initAdmin() {
  if (_admin && _admin.apps && _admin.apps.length) return _admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set");

  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    try {
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT does not appear to be JSON or base64");
    }
  }

  let svc: any;
  try {
    svc = JSON.parse(jsonStr);
    if (svc?.private_key && typeof svc.private_key === "string") {
      svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    }
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON");
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

function emailToId(email: string) {
  return Buffer.from(email.toLowerCase().trim()).toString("base64");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    // simple header-based protection: caller must send the secret header.
    const secret = req.headers.get("x-admin-secret") || "";
    const expected = process.env.NEXT_PUBLIC_ADMIN_ACTION_SECRET || process.env.ADMIN_ACTION_SECRET || "";
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "missing or invalid secret" }, { status: 401 });
    }

    const adm = await initAdmin();
    
    // First, check if the user exists in Firebase Auth
    let userExists = false;
    try {
      await adm.auth().getUserByEmail(email);
      userExists = true;
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log("[register-login-failure] user not found, not tracking failures for:", email);
        return NextResponse.json({ 
          attempts: 0, 
          disabled: false, 
          message: "User not found - not tracking failures" 
        });
      }
      // For other errors (network issues, etc.), we'll still track failures
      console.warn("[register-login-failure] error checking user existence:", e?.message || e);
      userExists = true; // Assume user exists if we can't verify (fail open for existing users)
    }

    if (!userExists) {
      return NextResponse.json({ 
        attempts: 0, 
        disabled: false, 
        message: "User not found - not tracking failures" 
      });
    }

    const id = emailToId(email);
    const ref = adm.firestore().collection("loginFailures").doc(id);
    const snap = await ref.get();
    const now = Date.now();
    let attempts = 1;
    if (snap.exists) {
      const data = snap.data() || {};
      attempts = (Number(data.attempts || 0) || 0) + 1;
    }

    const docData: any = { attempts, lastAttempt: adm.firestore.FieldValue.serverTimestamp() };

    let disabled = false;
    console.log("[register-login-failure]", { email, attempts, shouldDisable: attempts > 3 });
    if (attempts > 3) {
      // disable the Firebase Auth user (we already know they exist)
      try {
        const u = await adm.auth().getUserByEmail(email);
        console.log("[register-login-failure] found user, disabling:", { uid: u.uid, email: u.email, currentDisabled: u.disabled });
        await adm.auth().updateUser(u.uid, { disabled: true });
        docData.disabled = true;
        disabled = true;
        console.log("[register-login-failure] successfully disabled user");
      } catch (e: any) {
        console.warn("[register-login-failure] could not disable user:", e?.message || e);
      }
    }

    await ref.set(docData, { merge: true });

    return NextResponse.json({ attempts, disabled });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

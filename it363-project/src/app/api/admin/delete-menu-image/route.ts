import { NextRequest, NextResponse } from "next/server";

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
  adm.initializeApp({ 
    credential: adm.credential.cert(svc),
    storageBucket: "thestationfoodtruck-3938a.firebasestorage.app"
  });
  _admin = adm;
  return _admin;
}

export async function POST(req: NextRequest) {
  try {
    const adm = await initAdmin();

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adm.auth().verifyIdToken(token);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { menuId, sectionId, itemId } = await req.json();
    if (!menuId || !sectionId || !itemId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const menuRef = adm.firestore().collection("menus").doc(menuId);
    const snap = await menuRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Menu not found" }, { status: 404 });

    const data = snap.data() as any;
    const sections = data.sections ?? [];
    const sIdx = sections.findIndex((s: any) => s.id === sectionId);
    if (sIdx === -1) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    const iIdx = sections[sIdx].items?.findIndex((it: any) => it.id === itemId);
    if (iIdx === -1) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const existing = sections[sIdx].items[iIdx] || {};
    const photoPath: string | undefined = existing.photoPath;

    // Delete the file from storage if present
    if (photoPath) {
      try {
        const bucket = adm.storage().bucket("thestationfoodtruck-3938a.firebasestorage.app");
        await bucket.file(photoPath).delete({ ignoreNotFound: true } as any);
      } catch (e) {
        // Log and continue (file might already be gone)
        console.warn("[delete-menu-image] storage delete warning:", e);
      }
    }

    // Remove fields from the item and write back
  delete existing.photoUrl;
  delete existing.photoPath;
  delete (existing as any).photoUpdatedAt;
    sections[sIdx].items[iIdx] = existing;

    await menuRef.update({ sections });

    return NextResponse.json({ ok: true, item: existing });
  } catch (error: any) {
    console.error("[delete-menu-image] error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete image" }, { status: 500 });
  }
}

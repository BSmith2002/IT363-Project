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

    // 1) Verify the user is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adm.auth().verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2) Get form data
    const formData = await req.formData();
    const menuId = formData.get("menuId") as string;
    const sectionId = formData.get("sectionId") as string;
    const itemId = formData.get("itemId") as string;
    const file = formData.get("file") as File;

    if (!menuId || !sectionId || !itemId || !file) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 3) Read current item first to decide storage path (dedupe/replace)
    const menuRef = adm.firestore().collection("menus").doc(menuId);
    const menuSnap = await menuRef.get();
    
    if (!menuSnap.exists) {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }

    const data = menuSnap.data() as any;
    const sections = data.sections ?? [];
    const sIdx = sections.findIndex((s: any) => s.id === sectionId);
    
    if (sIdx === -1) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    
    const iIdx = sections[sIdx].items?.findIndex((it: any) => it.id === itemId);
    
    if (iIdx === -1) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const existingPath: string | undefined = sections[sIdx].items[iIdx]?.photoPath;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    // If a previous image exists, reuse the exact same object path (overwrite). Otherwise create a stable path.
    const objectPath = existingPath && existingPath.length
      ? existingPath
      : `menu-images/${menuId}/${itemId}.${ext}`;

    // 4) Upload to Storage (overwrites if same path exists)
    const bucket = adm.storage().bucket("thestationfoodtruck-3938a.firebasestorage.app");
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileRef = bucket.file(objectPath);
    
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: file.type,
        cacheControl: "public, max-age=3600" // one hour cache; updates propagate reasonably fast
      },
      // resumable false for small files to simplify
      resumable: false,
    });

    // Make the file publicly accessible
    await fileRef.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;

    // If we changed naming scheme from timestamped to stable, clean up the old file
    if (existingPath && existingPath !== objectPath) {
      try { await bucket.file(existingPath).delete(); } catch {}
    }

  sections[sIdx].items[iIdx].photoUrl = publicUrl;
  sections[sIdx].items[iIdx].photoPath = objectPath;
  sections[sIdx].items[iIdx].photoUpdatedAt = Date.now();

    await menuRef.update({ sections });

    // Read back the updated item to include in response (helps client validate)
    const updatedSnap = await menuRef.get();
    const updatedData = updatedSnap.data() as any;
    const updatedSections = updatedData?.sections ?? [];
    const updatedItem = (updatedSections.find((s: any) => s.id === sectionId)?.items || []).find((it: any) => it.id === itemId) || null;

    return NextResponse.json({ 
      url: publicUrl, 
      objectPath,
      item: updatedItem
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: error.message || "Upload failed" 
    }, { status: 500 });
  }
}

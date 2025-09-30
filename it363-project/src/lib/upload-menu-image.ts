"use client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function uploadMenuItemPhoto(
  menuId: string,
  sectionId: string,
  itemId: string,
  file: File
) {
  const ext = file.name.split(".").pop() || "jpg";
  const objectPath = `menu-images/${menuId}/${itemId}-${Date.now()}.${ext}`;

  // 1) Upload
  const storageRef = ref(storage, objectPath);
  await uploadBytes(storageRef, file, { contentType: file.type });

  // 2) Get a public download URL
  const url = await getDownloadURL(storageRef);

  // 3) Write the URL (and path) back to Firestore
  const menuRef = doc(db, "menus", menuId);
  const snap = await getDoc(menuRef);
  if (!snap.exists()) throw new Error("Menu not found");

  const data = snap.data() as any;
  const sections = data.sections ?? [];
  const sIdx = sections.findIndex((s: any) => s.id === sectionId);
  if (sIdx === -1) throw new Error("Section not found");
  const iIdx = sections[sIdx].items?.findIndex((it: any) => it.id === itemId);
  if (iIdx === -1) throw new Error("Item not found");

  sections[sIdx].items[iIdx].photoUrl = url;       // used by the UI
  sections[sIdx].items[iIdx].photoPath = objectPath; // optional: store path too

  await updateDoc(menuRef, { sections });

  return { url, objectPath };
}
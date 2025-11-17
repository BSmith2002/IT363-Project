"use client";
import { auth } from "@/lib/firebase";

export async function uploadMenuItemPhoto(
  menuId: string,
  sectionId: string,
  itemId: string,
  file: File
) {
  // Get the current user's ID token for authentication
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated to upload images");
  }

  const idToken = await user.getIdToken();

  // Create form data
  const formData = new FormData();
  formData.append("menuId", menuId);
  formData.append("sectionId", sectionId);
  formData.append("itemId", itemId);
  formData.append("file", file);

  // Call the server-side API route
  const response = await fetch("/api/admin/upload-menu-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  return { url: result.url, objectPath: result.objectPath };
}

export async function deleteMenuItemPhoto(
  menuId: string,
  sectionId: string,
  itemId: string,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be authenticated to delete images");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/admin/delete-menu-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ menuId, sectionId, itemId })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Delete failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.item as any;
}
import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, getDoc } from "firebase/firestore";
import { uploadMenuItemPhoto, deleteMenuItemPhoto } from "@/lib/upload-menu-image";
import { db } from "@/lib/firebase";
// ItemsTab implementation from AdminDashboard.tsx


// Utility types from AdminDashboard.tsx
type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  isSpicy?: boolean;
  photoUrl?: string;
  photoPath?: string;
};

type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

type MenuDoc = {
  id: string;
  name?: string;
  sections?: MenuSection[];
  createdAt?: any;
};

// Full ItemsTab implementation from AdminDashboard.tsx
export function ItemsTab({ menus }: { menus: MenuDoc[] }) {
  const [activeMenuId, setActiveMenuId] = useState<string>("");
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [showNewMenuForm, setShowNewMenuForm] = useState(false);
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 2500);
  };
  
  // Ref to clear file input when switching items
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New menu draft
  const [menuDraft, setMenuDraft] = useState({ name: "", copyFromDefault: true });
  
  // New section draft
  const [sectionDraft, setSectionDraft] = useState({ title: "" });

  // Item draft (for new or edit)
  const [draft, setDraft] = useState<{ name: string; desc: string; price: string; priceError: string | null; file: File | null; isSpicy: boolean }>(
    {
    name: "", desc: "", price: "", priceError: null, file: null, isSpicy: false
  });

  // Clear file input when switching between items or to create mode
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [editingItemId]);
  const activeMenu = useMemo(() => menus.find(m => m.id === activeMenuId), [menus, activeMenuId]);
  const sections = activeMenu?.sections ?? [];

  useEffect(() => {
    // If menu changes and current section no longer exists, clear it
    if (!sections.find(s => s.id === activeSectionId)) {
      setActiveSectionId(sections[0]?.id ?? "");
    }
  }, [sections, activeSectionId]);

  const validatePrice = (price: string) => {
    if (!price.trim()) return null; // Price is optional
    const numericPrice = Number(price.replace(/[^0-9.]/g, ''));
    if (isNaN(numericPrice) || numericPrice < 0) {
      return "Please enter a valid price (e.g., 9.99)";
    }
    return null;
  };

  async function addItem() {
    // Required field validation
    if (!activeMenuId) {
      showToast("Please select a menu.", "error");
      return;
    }
    if (!activeSectionId) {
      showToast("Please select a section.", "error");
      return;
    }
    if (!draft.name.trim()) {
      setDraft(prev => ({ ...prev, priceError: null }));
      showToast("Item name is required.", "error");
      return;
    }
    const m = activeMenu; if (!m) return;
    const priceError = validatePrice(draft.price);
    if (priceError) {
      setDraft(prev => ({ ...prev, priceError }));
      return;
    }
    const newId = crypto.randomUUID();
    const nextSections = (m.sections ?? []).map(s => {
      if (s.id !== activeSectionId) return s;
      // Build new item without including undefined fields (Firestore rejects undefined)
      const newItem: any = {
        id: newId,
        name: draft.name.trim()
      };
      if (draft.desc.trim()) newItem.desc = draft.desc.trim();
      if (draft.price.trim()) newItem.price = Number(draft.price.replace(/[^0-9.]/g, '')).toFixed(2);
      if (draft.isSpicy) newItem.isSpicy = true;
      const nextItems = [
        ...s.items,
        newItem as MenuItem
      ];
      return { ...s, items: nextItems };
    });

    await updateDoc(doc(db, "menus", activeMenuId), { sections: nextSections });

    // If a file was selected, upload it and update the item's photoUrl in Firestore
    try {
      if (draft.file) {
        await uploadMenuItemPhoto(activeMenuId, activeSectionId, newId, draft.file);
        showToast('Image uploaded');
      }
    } catch (e) {
      console.error("Failed to upload image for item", e);
      showToast('Image upload failed', 'error');
    }

    setDraft({ name: "", desc: "", price: "", priceError: null, file: null, isSpicy: false });
  }

  return (
    <div className="space-y-8 relative">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 shadow-lg border ${toast.type === 'error' ? 'bg-red-800 text-white border-red-800' : 'bg-green-600 text-white border-green-700'}`}>
          {toast.msg}
        </div>
      )}
      {/* Menu Management */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Manage Menus</h2>
          <button
            onClick={() => setShowNewMenuForm(true)}
            className="rounded bg-red-800 text-white px-3 py-1 hover:opacity-90"
          >
            Create New Menu
          </button>
        </div>

        {/* New Menu Form */}
        {showNewMenuForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-black/10">
            <h3 className="text-lg font-medium mb-3">Create New Menu</h3>
            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Menu Name"
                  className="rounded px-3 py-2 border border-black/20"
                  value={menuDraft.name}
                  onChange={e => setMenuDraft(prev => ({ ...prev, name: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={menuDraft.copyFromDefault}
                    onChange={e => setMenuDraft(prev => ({ ...prev, copyFromDefault: e.target.checked }))}
                  />
                  Copy sections from "Default Menu"
                </label>
              </div>
              <button
                onClick={async () => {
                  if (!menuDraft.name.trim()) return;
                  // Find the default menu to copy from if needed
                  let sectionsToUse: MenuSection[] = [];
                  if (menuDraft.copyFromDefault) {
                    const defaultMenu = menus.find(m => m.name?.toLowerCase() === "default menu");
                    if (defaultMenu) {
                      sectionsToUse = defaultMenu.sections ?? [];
                    }
                  }
                  await addDoc(collection(db, "menus"), {
                    name: menuDraft.name.trim(),
                    sections: sectionsToUse,
                    createdAt: serverTimestamp()
                  });
                  setMenuDraft({ name: "", copyFromDefault: true });
                  setShowNewMenuForm(false);
                }}
                className="rounded bg-red-800 text-white px-4 py-2 hover:opacity-90"
              >
                Create Menu
              </button>
              <button
                onClick={() => {
                  setMenuDraft({ name: "", copyFromDefault: true });
                  setShowNewMenuForm(false);
                }}
                className="rounded bg-black/10 px-4 py-2 hover:bg-black/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Menu Selection and Section Management */}
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-black/70">Select Menu to Edit</label>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded px-3 py-2 border border-black/20"
                value={activeMenuId}
                onChange={(e) => {
                  setActiveMenuId(e.target.value);
                  setActiveSectionId("");
                }}
              >
                <option value="">— Choose a menu —</option>
                {menus.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id}
                  </option>
                ))}
              </select>
              {activeMenuId && (
                <button
                  onClick={async () => {
                    if (!confirm("Delete this menu? This cannot be undone.")) return;
                    await deleteDoc(doc(db, "menus", activeMenuId));
                    setActiveMenuId("");
                  }}
                  className="rounded bg-red-800 text-white px-3 py-1 hover:opacity-90"
                >
                  Delete Menu
                </button>
              )}
            </div>
          </div>

          {activeMenuId && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-black/70">Menu Sections</label>
                  <button
                    onClick={() => setShowNewSectionForm(true)}
                    className="text-sm text-red-800 hover:underline"
                  >
                    + Add New Section
                  </button>
                </div>

                {/* New Section Form */}
                {showNewSectionForm && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-black/10">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Section Title"
                        className="flex-1 rounded px-3 py-2 border border-black/20"
                        value={sectionDraft.title}
                        onChange={e => setSectionDraft({ title: e.target.value })}
                      />
                      <button
                        onClick={async () => {
                          if (!sectionDraft.title.trim()) return;
                          const menu = menus.find(m => m.id === activeMenuId);
                          if (!menu) return;

                          const nextSections = [
                            ...(menu.sections ?? []),
                            {
                              id: crypto.randomUUID(),
                              title: sectionDraft.title.trim(),
                              items: []
                            }
                          ];

                          await updateDoc(doc(db, "menus", activeMenuId), {
                            sections: nextSections
                          });

                          setSectionDraft({ title: "" });
                          setShowNewSectionForm(false);
                        }}
                        className="rounded bg-red-800 text-white px-3 py-1 hover:opacity-90"
                      >
                        Add Section
                      </button>
                      <button
                        onClick={() => {
                          setSectionDraft({ title: "" });
                          setShowNewSectionForm(false);
                        }}
                        className="rounded bg-black/10 px-3 py-1 hover:bg-black/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <select
                  className="rounded px-3 py-2 border border-black/20"
                  value={activeSectionId}
                  onChange={(e) => setActiveSectionId(e.target.value)}
                >
                  <option value="">— Select a section —</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>

                {activeSectionId && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={async () => {
                        let menu = menus.find(m => m.id === activeMenuId);
                        if (!menu) return;

                        const section = menu.sections?.find(s => s.id === activeSectionId);
                        if (!section) return;

                        const newTitle = prompt("Enter new section title:", section.title);
                        if (!newTitle?.trim()) return;

                        const nextSections = menu.sections?.map(s =>
                          s.id === activeSectionId
                            ? { ...s, title: newTitle.trim() }
                            : s
                        );

                        await updateDoc(doc(db, "menus", activeMenuId), {
                          sections: nextSections
                        });
                      }}
                      className="text-sm text-black/70 hover:text-black"
                    >
                      Rename Section
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this section and all its items?")) return;
                        const menu = menus.find(m => m.id === activeMenuId);
                        if (!menu) return;

                        const nextSections = menu.sections?.filter(s => s.id !== activeSectionId) ?? [];
                        await updateDoc(doc(db, "menus", activeMenuId), {
                          sections: nextSections
                        });
                        setActiveSectionId("");
                      }}
                      className="text-sm text-red-800 hover:text-red-800"
                    >
                      Delete Section
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Item Management */}
      <div className="rounded-2xl border border-black/10 p-5 bg-white">
        {!activeMenuId ? (
          <p className="text-black/70">Choose a menu above to manage items.</p>
        ) : sections.length === 0 ? (
          <p className="text-black/70">This menu has no sections yet. Create a section first in your menus editor.</p>
        ) : !activeSectionId ? (
          <p className="text-black/70">Select a section to manage its items.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Manage Items</h2>
              <button
                onClick={() => {
                  setEditingItemId(null);
                  setDraft({ name: "", desc: "", price: "", priceError: null, file: null, isSpicy: false });
                }}
                className={`text-sm ${editingItemId === null ? 'text-red-800 font-medium' : 'text-black/70'} hover:underline`}
              >
                + Create New Item
              </button>
            </div>

            {/* Existing Items List */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-3">Section Items</h3>
              {sections.find(s => s.id === activeSectionId)?.items.length === 0 ? (
                <p className="text-black/70">No items in this section yet.</p>
              ) : (
                <div className="grid gap-3">
                  {sections.find(s => s.id === activeSectionId)?.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between border-b border-black/10 pb-3">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.price && <div className="text-sm text-black/70">${item.price}</div>}
                        {item.desc && <div className="text-sm text-black/70">{item.desc}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingItemId(item.id);
                            setDraft({
                              name: item.name,
                              desc: item.desc || "",
                              price: item.price || "",
                              priceError: null,
                              file: null,
                              isSpicy: item.isSpicy || false
                            });
                          }}
                          className="text-sm text-black/70 hover:text-black"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this item?')) return;
                            const menu = menus.find(m => m.id === activeMenuId);
                            if (!menu) return;

                            const nextSections = menu.sections?.map(s =>
                              s.id === activeSectionId
                                ? { ...s, items: s.items.filter(i => i.id !== item.id) }
                                : s
                            ) ?? [];

                            await updateDoc(doc(db, "menus", activeMenuId), {
                              sections: nextSections
                            });
                          }}
                          className="text-sm text-red-800 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Item Form (Edit or Create) */}
            <div className="border-t border-black/10 pt-6">
              <h3 className="text-lg font-medium mb-4">
                {editingItemId === null ? "Add New Item" : "Edit Item"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-black/70">Name</label>
                  <input
                    className="rounded px-3 py-2 border border-black/20"
                    value={draft.name}
                    onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Item name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-black/70">Price ($)</label>
                  <input
                    className={`rounded px-3 py-2 border ${draft.priceError ? 'border-red-800' : 'border-black/20'}`}
                    value={draft.price}
                    onChange={e => {
                      const value = e.target.value;
                      const error = validatePrice(value);
                      setDraft(prev => ({ ...prev, price: value, priceError: error }));
                    }}
                    placeholder="e.g., 9.99"
                    type="text"
                    pattern="[0-9]*\.?[0-9]*"
                  />
                  {draft.priceError && (
                    <div className="text-xs text-red-800">{draft.priceError}</div>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm text-black/70">Description</label>
                  <input
                    className="rounded px-3 py-2 border border-black/20"
                    value={draft.desc}
                    onChange={e => setDraft(prev => ({ ...prev, desc: e.target.value }))}
                    placeholder="Short description"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.isSpicy}
                      onChange={e => setDraft(prev => ({ ...prev, isSpicy: e.target.checked }))}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-black/70">Spicy Item 🌶️</span>
                  </label>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-black/70">Upload Image</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Optional</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    className="rounded px-3 py-2 border border-black/20"
                    type="file"
                    accept="image/*"
                    onChange={e => setDraft(prev => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                  />
                  {/* Current image preview for edit mode */}
                  {editingItemId && (() => {
                    const currentItem = sections.find(s => s.id === activeSectionId)?.items.find(i => i.id === editingItemId);
                    const currentUrl = currentItem?.photoUrl;
                    const currentPath = (currentItem as any)?.photoPath as string | undefined;
                    return currentUrl ? (
                      <div className="mt-3">
                        <div className="text-sm text-black/70 mb-2">Currently used image {currentPath ? `(${currentPath})` : ""}</div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg border border-black/10 inline-block bg-white">
                            <img src={currentUrl} alt="Current item" className="h-24 w-24 object-cover rounded" />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!editingItemId) return;
                              if (!confirm("Remove this image from the item?")) return;
                              try {
                                await deleteMenuItemPhoto(activeMenuId, activeSectionId, editingItemId);
                                setDraft(prev => ({ ...prev, file: null }));
                                if (fileInputRef.current) fileInputRef.current.value = "";
                                // Refresh sections so UI reflects removal immediately
                                const snap = await getDoc(doc(db, "menus", activeMenuId));
                                if (snap.exists()) {
                                  const data = snap.data() as any;
                                  // Find updated item and no-op; the live list uses Firestore listener elsewhere
                                }
                                showToast('Image removed');
                              } catch (e: any) {
                                showToast("Failed to remove image", 'error');
                              }
                            }}
                            className="text-sm px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300"
                          >
                            Remove Image
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {editingItemId === null ? (
                  <button
                    onClick={addItem}
                    disabled={!draft.name.trim()}
                    className="rounded bg-red-800 text-white px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    Add Item
                  </button>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        if (!draft.name.trim()) return;
                        const menu = menus.find(m => m.id === activeMenuId);
                        if (!menu) return;

                        console.log("Edit save: file selected?", !!draft.file, "editingItemId:", editingItemId);

                        // If a new image file was provided, upload it FIRST
                        let uploaded = false;
                        if (draft.file && editingItemId) {
                          console.log("Uploading image...", draft.file.name);
                          try {
                            const result = await uploadMenuItemPhoto(activeMenuId, activeSectionId, editingItemId, draft.file);
                            console.log("Image uploaded successfully:", result);
                            uploaded = true;
                            showToast('Image uploaded');
                          } catch (e) {
                            console.error("Failed to upload image for edited item", e);
                            showToast("Failed to upload image", 'error');
                            return;
                          }
                        }
                        // If we uploaded an image, re-read the latest sections from Firestore to avoid clobbering photoUrl/photoPath
                        let sourceSections = menu.sections ?? [];
                        if (uploaded) {
                          try {
                            const snap = await getDoc(doc(db, "menus", activeMenuId));
                            if (snap.exists()) {
                              const data = snap.data() as any;
                              sourceSections = data.sections ?? [];
                            }
                          } catch {}
                        }

                        const nextSections = sourceSections.map(s =>
                          s.id === activeSectionId
                            ? {
                                ...s,
                                        items: s.items.map(i =>
                                          i.id === editingItemId
                                            ? (() => {
                                                // Build updated item without undefined values
                                                const updated: any = { ...i, name: draft.name.trim() };
                                                if (draft.desc.trim()) {
                                                  updated.desc = draft.desc.trim();
                                                } else {
                                                  delete updated.desc;
                                                }
                                                if (draft.price.trim()) {
                                                  updated.price = Number(draft.price.replace(/[^0-9.]/g, '')).toFixed(2);
                                                } else {
                                                  delete updated.price;
                                                }
                                                if (draft.isSpicy) {
                                                  updated.isSpicy = true;
                                                } else {
                                                  delete updated.isSpicy;
                                                }
                                                return updated as MenuItem;
                                              })()
                                            : i
                                        )
                              }
                            : s
                        );

                        await updateDoc(doc(db, "menus", activeMenuId), {
                          sections: nextSections
                        });

                        setEditingItemId(null);
                        setDraft({ name: "", desc: "", price: "", priceError: null, file: null, isSpicy: false });
                      }}
                      disabled={!draft.name.trim()}
                      className="rounded bg-red-800 text-white px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setEditingItemId(null);
                        setDraft({ name: "", desc: "", price: "", priceError: null, file: null, isSpicy: false });
                      }}
                      className="rounded bg-black/10 px-4 py-2 font-medium hover:bg-black/20"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )



}

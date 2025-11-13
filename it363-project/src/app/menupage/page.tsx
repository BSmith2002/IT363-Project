"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MenuView from "@/components/MenuView";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

type MenuOption = {
  id: string;
  name: string;
};

export default function MenuPage() {
  const [availableMenus, setAvailableMenus] = useState<MenuOption[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");

  const [loading, setLoading] = useState(true);

  // Fetch available menus from Firebase
  useEffect(() => {
    async function fetchMenus() {
      try {
        setLoading(true);
        const menusCollection = collection(db, "menus");
        const menusSnapshot = await getDocs(menusCollection);
        
        const menus: MenuOption[] = menusSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Menu ${doc.id}` // Use the name from Firestore or fallback
        }));
        
        setAvailableMenus(menus);
        
        // Auto-select the first menu if available
        if (menus.length > 0) {
          setSelectedMenuId(menus[0].id);
        }
      } catch (error) {
        console.error("Error fetching menus:", error);
        // Set some fallback menus in case of error
        const fallbackMenus = [
          { id: "1", name: "Main Menu" }
        ];
        setAvailableMenus(fallbackMenus);
        setSelectedMenuId("1");
      } finally {
        setLoading(false);
      }
    }

    fetchMenus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      {/* Main content wrapper with proper spacing */}
      <div className="content-wrapper flex-1 bg-gray-50">
        <main className="pb-20 px-4 sm:px-6 min-h-full">
          <div className="w-full max-w-6xl mx-auto">
            {/* Page Title */}
            <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-center text-gray-800">
              Our Menu
            </h1>

            {/* Menu Selection Dropdown */}
            <div className="mb-12 flex justify-center">
              <div className="relative w-full max-w-md">
                <label htmlFor="menu-select" className="block text-lg font-bold text-black mb-4 text-center">
                  Select Menu:
                </label>
                {loading ? (
                  <div className="block w-full px-6 py-4 bg-white border-2 border-red-600 rounded-lg text-center text-gray-600 font-medium shadow-md">
                    Loading menus...
                  </div>
                ) : (
                  <select
                    id="menu-select"
                    value={selectedMenuId}
                    onChange={(e) => setSelectedMenuId(e.target.value)}
                    className="block w-full px-6 py-4 bg-white border-2 border-red-600 rounded-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-red-200 focus:border-red-700 text-center text-lg font-medium text-gray-800 hover:border-red-700 transition-all duration-200 cursor-pointer"
                    disabled={availableMenus.length === 0}
                  >
                    {availableMenus.length === 0 ? (
                      <option value="">No menus available</option>
                    ) : (
                      availableMenus.map((menu) => (
                        <option key={menu.id} value={menu.id} className="bg-white text-gray-800 py-2">
                          {menu.name}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>
            </div>



            {/* Menu Content */}
            <div className="flex justify-center mb-12">
              {loading ? (
                <div className="text-center text-gray-500 p-8">
                  Loading menu content...
                </div>
              ) : selectedMenuId ? (
                <MenuView menuId={selectedMenuId} />
              ) : (
                <div className="text-center text-gray-600 p-8 bg-white rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold mb-2">No Menu Selected</h3>
                  <p>Please select a menu from the dropdown above to view items.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


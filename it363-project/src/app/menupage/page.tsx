"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MenuView from "@/components/MenuView";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MenuPage() {
  const [defaultMenuId, setDefaultMenuId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Fetch the default menu from Firebase
  useEffect(() => {
    async function fetchDefaultMenu() {
      try {
        setLoading(true);
        const menusCollection = collection(db, "menus");
        const menusSnapshot = await getDocs(menusCollection);
        
        const menus = menusSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Menu ${doc.id}`
        }));
        
        // Auto-select a sensible default:
        // 1) A menu named "Default Menu" (case-insensitive)
        // 2) Otherwise the first menu returned
        if (menus.length > 0) {
          const preferred = menus.find(m => (m.name || "").trim().toLowerCase() === "default menu");
          setDefaultMenuId((preferred ?? menus[0]).id);
        }
      } catch (error) {
        console.error("Error fetching menus:", error);
        setDefaultMenuId("1");
      } finally {
        setLoading(false);
      }
    }

    fetchDefaultMenu();
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      {/* Main content wrapper with proper spacing */}
          <div className="w-full max-w-6xl mx-auto">
            {/* Menu Content */}
            <div className="flex justify-center mb-12">
              {loading ? (
                <div className="text-center text-gray-500 p-8">
                  Loading menu...
                </div>
              ) : defaultMenuId ? (
                <MenuView menuId={defaultMenuId} />
              ) : (
                <div className="text-center text-gray-600 p-8 bg-white rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold mb-2">No Menu Available</h3>
                  <p>Please check back later.</p>
                </div>
              )}
            </div>
          </div>

      </div>
  );
}
import { useState } from "react";
import { Outlet } from "react-router";
import { Header } from "./Header";
import { TabNavigation } from "./TabNavigation";

export function Layout() {
  const [language, setLanguage] = useState("en");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <Header language={language} onLanguageChange={setLanguage} />
        <TabNavigation />
        <main className="mt-4 sm:mt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
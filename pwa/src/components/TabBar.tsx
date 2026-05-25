import { useLocation, useNavigate } from "react-router-dom";
import { IconHome, IconSettings } from "./Icons";
import type { ReactNode } from "react";

interface TabItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const tabs: TabItem[] = [
  { path: "/", label: "Home", icon: <IconHome className="w-5 h-5" /> },
  { path: "/settings", label: "Settings", icon: <IconSettings className="w-5 h-5" /> },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-40"
    >
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`
                flex flex-col items-center justify-center
                min-h-touch min-w-touch py-2 px-4
                text-sm font-medium transition-colors
                ${isActive ? "text-primary-400" : "text-gray-400 hover:text-gray-200"}
              `}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon}
              <span className="mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

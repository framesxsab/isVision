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
      className="fixed bottom-0 left-0 right-0 bg-stone-950/95 backdrop-blur border-t border-stone-700 z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex justify-around items-center max-w-3xl mx-auto px-3">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`
                flex flex-col items-center justify-center
                min-h-touch min-w-[88px] py-1 px-3
                text-xs font-medium transition-colors
                border-t-2
                ${
                  isActive
                    ? "text-primary-300 border-primary-400"
                    : "text-stone-400 hover:text-stone-100 border-transparent"
                }
              `}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

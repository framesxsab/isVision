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
      className="fixed left-0 right-0 z-40 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="max-w-md mx-auto px-4 pointer-events-auto">
        <div className="
          relative
          flex items-stretch justify-around
          rounded-full
          bg-surface-1/85 backdrop-blur-xl
          border border-surface-border
          shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)]
          px-2 py-1.5
        ">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`
                  relative flex-1 flex items-center justify-center gap-2
                  min-h-touch px-4 rounded-full
                  text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-primary-500/15 text-primary-200 ring-1 ring-primary-400/30"
                      : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
                  }
                `}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={isActive ? "text-primary-300" : ""}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

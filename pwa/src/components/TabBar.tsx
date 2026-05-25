import { useLocation, useNavigate } from "react-router-dom";

interface TabItem {
  path: string;
  label: string;
  icon: string;
}

const tabs: TabItem[] = [
  { path: "/", label: "Home", icon: "\u2302" },
  { path: "/settings", label: "Settings", icon: "\u2699" },
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
              <span className="text-xl" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

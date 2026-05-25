import { createContext, useContext, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

type Politeness = "polite" | "assertive";

interface AriaLiveContextType {
  announce: (message: string, politeness?: Politeness) => void;
}

const AriaLiveContext = createContext<AriaLiveContextType | null>(null);

export function useAnnounce() {
  const ctx = useContext(AriaLiveContext);
  if (!ctx) throw new Error("useAnnounce must be used within AriaLiveProvider");
  return ctx.announce;
}

export function AriaLiveProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = useCallback((message: string, politeness: Politeness = "assertive") => {
    // Clear first to ensure screen readers pick up repeated messages
    if (politeness === "assertive") {
      setAssertiveMessage("");
    } else {
      setPoliteMessage("");
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (politeness === "assertive") {
        setAssertiveMessage(message);
      } else {
        setPoliteMessage(message);
      }
    }, 50);
  }, []);

  return (
    <AriaLiveContext.Provider value={{ announce }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AriaLiveContext.Provider>
  );
}

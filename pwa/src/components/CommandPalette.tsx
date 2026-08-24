import { useEffect, useState } from "react";
import { commands } from "@/modules/voice-nav/commandRegistry";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { FocusTrap } from "@/core/a11y/FocusTrap";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const announce = useAnnounce();
  const filtered = commands.filter((c) => `${c.patterns[0]} ${c.description}`.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    if (open) announce(`${filtered.length} commands`);
  }, [open, filtered.length, announce]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70" role="presentation" onClick={onClose}>
      <FocusTrap active>
        <div className="bg-surface-1 border border-surface-border rounded-2xl p-4 w-full max-w-lg mx-4" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
          <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type a command..." className="w-full bg-surface-2 text-white border border-surface-border rounded-xl px-4 py-3 mb-3" aria-label="Filter commands" />
          <ul className="max-h-64 overflow-auto space-y-1">
            {filtered.map((c) => (
              <li key={c.name} className="px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-stone-200">{c.patterns[0]} — {c.description}</li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-2">Press Escape to close. F6 for voice.</p>
        </div>
      </FocusTrap>
    </div>
  );
}

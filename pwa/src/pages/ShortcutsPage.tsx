import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { getShortcuts } from "@/core/a11y/shortcuts";

export default function ShortcutsPage() {
  const [filter, setFilter] = useState("");
  const shortcuts = getShortcuts();
  const extra = [
    { key: "Space", description: "Reader play/pause" },
    { key: "ArrowRight/Left", description: "Reader paragraph next/prev" },
    { key: "Alt+Arrow", description: "Reader sentence next/prev" },
    { key: "S/T", description: "Reader speed up/down" },
    { key: "F6", description: "Voice command anywhere" },
    { key: "Cmd+K", description: "Command palette" },
  ];
  const all = [...shortcuts, ...extra];
  const filtered = all.filter((s) => `${s.key} ${s.description}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <PageShell title="Keyboard Shortcuts" accent="emerald">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <label htmlFor="shortcut-filter" className="sr-only">Filter shortcuts</label>
        <input id="shortcut-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter shortcuts..." className="w-full bg-surface-2 text-white border border-surface-border rounded-xl px-4 py-3 mb-4" />
        <ul className="space-y-2" aria-live="polite">
          {filtered.map((s) => (
            <li key={s.key} className="flex justify-between bg-surface-1 border border-surface-border rounded-xl px-4 py-3">
              <span className="font-mono text-primary-300">{s.key}</span>
              <span className="text-stone-300 text-sm">{s.description}</span>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-stone-500 text-sm" role="status">No shortcuts match.</li>}
        </ul>
      </div>
    </PageShell>
  );
}

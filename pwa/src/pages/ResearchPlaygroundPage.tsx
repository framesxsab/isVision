import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { useAnnounce } from "@/core/a11y/AriaLive";

type Task = { id: string; name: string; start: number | null; end: number | null };

export default function ResearchPlaygroundPage() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: "A", name: "Reader → Tactile", start: null, end: null },
    { id: "B", name: "Drill 5 letters", start: null, end: null },
    { id: "C", name: "Touch Explorer vs OS", start: null, end: null },
  ]);
  const [sus, setSus] = useState<number[]>(Array(10).fill(3));
  const [sessions, setSessions] = useState<string[]>([]);
  const announce = useAnnounce();

  const startTask = (id: string) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, start: Date.now(), end: null } : t)));
    announce(`Started task ${id}`);
  };
  const stopTask = (id: string) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, end: Date.now() } : t)));
    announce(`Stopped task ${id}`);
  };
  const exportCsv = () => {
    const rows = ["task_id,task_name,start_iso,end_iso,duration_s"];
    for (const t of tasks) {
      const s = t.start ? new Date(t.start).toISOString() : "";
      const e = t.end ? new Date(t.end).toISOString() : "";
      const d = t.start && t.end ? Math.round((t.end - t.start) / 1000) : "";
      rows.push(`${t.id},${t.name},${s},${e},${d}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "task_timing.csv";
    a.click();
    URL.revokeObjectURL(url);
    announce("Exported CSV");
  };

  const recordSession = () => {
    const entry = `Session ${sessions.length + 1} — ${new Date().toISOString()} — SUS ${sus.reduce((a, b) => a + b, 0)}`;
    setSessions((s) => [...s, entry]);
    announce("Recorded anonymous session");
  };

  const susScore = (() => {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const v = sus[i] ?? 3;
      sum += i % 2 === 0 ? v - 1 : 5 - v;
    }
    return sum * 2.5;
  })();

  return (
    <PageShell title="Research Playground" accent="emerald">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section aria-labelledby="timer-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="timer-heading" className="text-lg font-semibold text-stone-50">Task timer</h2>
          <ul className="mt-3 space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 surface-card border border-surface-border rounded-xl p-3">
                <span className="text-stone-200">{t.id}: {t.name}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" onClick={() => startTask(t.id)} aria-label={`Start ${t.name}`}>Start</Button>
                  <Button variant="ghost" onClick={() => stopTask(t.id)} aria-label={`Stop ${t.name}`}>Stop</Button>
                </span>
              </li>
            ))}
          </ul>
          <Button onClick={exportCsv} className="mt-4" aria-label="Export task timing CSV">Export CSV</Button>
        </section>

        <section aria-labelledby="sus-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="sus-heading" className="text-lg font-semibold text-stone-50">SUS recorder</h2>
          <p className="text-sm text-stone-400">Score: {susScore} / 100 (Brooke). No participants invented — record real sessions only.</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {sus.map((v, i) => (
              <label key={i} className="flex flex-col gap-1">
                <span className="text-xs text-stone-500">Q{i + 1}</span>
                <select value={v} onChange={(e) => setSus((s) => s.map((x, j) => (j === i ? parseInt(e.target.value) : x)))} className="bg-surface-2 text-stone-100 border border-surface-border rounded-lg px-2 py-2" aria-label={`SUS question ${i + 1}`}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section aria-labelledby="session-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="session-heading" className="text-lg font-semibold text-stone-50">Anonymous session recorder</h2>
          <p className="text-sm text-stone-400 mt-1">Stores session ID + timestamp + SUS only — no PII. Use tools/anonymize_field_notes.py before commit.</p>
          <Button onClick={recordSession} className="mt-3" aria-label="Record anonymous session">Record session</Button>
          <ol aria-label="Sessions" className="mt-3 space-y-1">
            {sessions.map((s, i) => <li key={i} className="text-sm text-stone-300">{s}</li>)}
          </ol>
        </section>

        <section aria-labelledby="metrics-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="metrics-heading" className="text-lg font-semibold text-stone-50">Metrics dashboard (replay viewer)</h2>
          <p className="text-sm text-stone-400">Task timing + SUS from this page + CSV. Replay is local — no cloud.</p>
          <ul className="mt-2 text-sm text-stone-300 list-disc pl-5">
            <li>Tasks: {tasks.filter((t) => t.start && t.end).length} completed</li>
            <li>SUS: {susScore}</li>
            <li>Sessions: {sessions.length}</li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

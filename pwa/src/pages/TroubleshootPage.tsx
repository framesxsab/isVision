// Troubleshoot — capability triage surface for users (and supporters helping
// over the phone) to see at a glance which browser features isVisible can use
// on this device. Per docs/ux-impact-plan.md this is intentionally a sub-page,
// not the primary onboarding surface — the *inline* "Camera is blocked, tap
// here to fix it" copy on each module is the real fix for non-technical users.
// This page is for cases where the inline copy isn't enough.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { IconArrowLeft } from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { useSettingsStore } from "@/core/store/settingsStore";
import {
  detectCapability,
  queryMediaPermission,
  type CapabilityId,
  type CapabilityReport,
} from "@/core/utils/capabilities";

interface Row {
  id: string;
  label: string;
  hint: string;
  report: CapabilityReport;
  // Optional CTA — for permission-class rows we route to the onboarding
  // restart flow; for capability-class rows there's nothing actionable in
  // the app itself, so we leave it undefined.
  cta?: { label: string; onClick: () => void };
}

const CAPABILITY_LABELS: Record<CapabilityId, { label: string; hint: string }> = {
  camera: {
    label: "Camera API",
    hint: "Browser support needed before AI Vision can request camera access.",
  },
  microphone: {
    label: "Microphone API",
    hint: "Browser support needed before Voice Navigation can request microphone access.",
  },
  "speech-synthesis": {
    label: "Speech synthesis",
    hint: "The voice that reads pages and confirms actions.",
  },
  "speech-recognition": {
    label: "Speech recognition",
    hint: "Powers Voice Navigation and the F6 hotkey.",
  },
  "clipboard-write": {
    label: "Clipboard copy",
    hint: "Lets AI Vision and Tactile Lab copy text out.",
  },
  "clipboard-read": {
    label: "Clipboard paste",
    hint: "Lets Tactile Lab pick up text you've copied elsewhere.",
  },
  "web-serial": {
    label: "Web Serial",
    hint: "Needed to talk to a wired refreshable braille display.",
  },
  "web-hid": {
    label: "WebHID",
    hint: "Alternative path to braille hardware on Chromium.",
  },
  vibration: {
    label: "Vibration",
    hint: "Adds haptic orientation cues on supported phones and tablets.",
  },
  "service-worker": {
    label: "Service worker",
    hint: "Keeps the installed app shell available offline.",
  },
  "cache-storage": {
    label: "Cache Storage",
    hint: "Stores braille translation assets and app files for offline use.",
  },
};

// Order matters — the items a blind user is most likely to need are at the
// top, with hardware capabilities at the bottom (hardware is contributor /
// power-user territory, not the default journey).
const CAPABILITY_ORDER: CapabilityId[] = [
  "camera",
  "microphone",
  "speech-synthesis",
  "speech-recognition",
  "vibration",
  "clipboard-write",
  "clipboard-read",
  "service-worker",
  "cache-storage",
  "web-serial",
  "web-hid",
];

export default function TroubleshootPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();
  const setupStatus = useSettingsStore((s) => s.setupStatus);
  const setSetupStatus = useSettingsStore((s) => s.setSetupStatus);

  // Detect everything on mount and on a manual refresh. We don't auto-poll —
  // a blind user re-reading the page should hear stable content, not have
  // it shift under them every second.
  const [refreshTick, setRefreshTick] = useState(0);

  const rows = useMemo<Row[]>(() => {
    // Permission rows come first because they're the most common source of
    // "the app feels broken" — and the ones we can actually fix in-app.
    const permissionRows: Row[] = [
      {
        id: "camera-permission",
        label: "Camera access",
        hint: "Required for AI Vision scene descriptions.",
        report: permissionToReport(setupStatus.camera, "camera"),
        cta:
          setupStatus.camera === "granted"
            ? undefined
            : {
                label: "Re-run setup",
                onClick: () => navigate("/onboarding?restart=1"),
              },
      },
      {
        id: "microphone-permission",
        label: "Microphone access",
        hint: "Required for Voice Navigation and the F6 hotkey.",
        report: permissionToReport(setupStatus.microphone, "microphone"),
        cta:
          setupStatus.microphone === "granted"
            ? undefined
            : {
                label: "Re-run setup",
                onClick: () => navigate("/onboarding?restart=1"),
              },
      },
    ];

    const capabilityRows: Row[] = CAPABILITY_ORDER.map((id) => {
      const meta = CAPABILITY_LABELS[id];
      return {
        id,
        label: meta.label,
        hint: meta.hint,
        report: detectCapability(id),
      };
    });

    return [...permissionRows, ...capabilityRows];
    // refreshTick is the explicit "re-read" signal; including setupStatus in
    // deps makes the permission rows track the store live without a manual
    // refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupStatus, refreshTick, navigate]);

  const blockedCount = rows.filter((r) => !r.report.available).length;

  const refreshPermissionStatus = useCallback(async () => {
    const [camera, microphone] = await Promise.all([
      queryMediaPermission("camera"),
      queryMediaPermission("microphone"),
    ]);
    setSetupStatus({
      ...(camera ? { camera } : {}),
      ...(microphone ? { microphone } : {}),
    });
  }, [setSetupStatus]);

  useEffect(() => {
    announce(
      blockedCount === 0
        ? "Troubleshoot. Everything looks ready on this device."
        : `Troubleshoot. ${blockedCount} item${blockedCount === 1 ? " needs" : "s need"} attention.`
    );
    // We deliberately re-announce when the blocked count changes so a
    // returning user with a fix in hand hears the new summary.
  }, [announce, blockedCount]);

  useEffect(() => {
    void refreshPermissionStatus();
    const onFocus = () => void refreshPermissionStatus();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshPermissionStatus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshPermissionStatus]);

  const handleRefresh = () => {
    void refreshPermissionStatus();
    setRefreshTick((t) => t + 1);
    announce("Status refreshed.");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/settings")} aria-label="Back to settings">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Settings
          </Button>
          <h1 className="text-lg font-bold text-white">Troubleshoot</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="flex-1 px-4 py-5 pb-nav max-w-lg mx-auto w-full space-y-6">
        <section
          aria-label="Summary"
          className={`rounded-2xl border p-4 ${
            blockedCount === 0
              ? "bg-emerald-500/10 border-emerald-400/30"
              : "bg-amber-500/10 border-amber-400/30"
          }`}
        >
          <p className="text-stone-50 font-semibold mb-1">
            {blockedCount === 0
              ? "Everything looks ready"
              : `${blockedCount} item${blockedCount === 1 ? "" : "s"} need attention`}
          </p>
          <p className="text-sm text-stone-300 leading-relaxed">
            Each row below shows whether a feature is available on this device
            and what to do when it isn't. Most modules will still work without
            the optional hardware features.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleRefresh} aria-label="Refresh capability checks">
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/onboarding?restart=1")}
              aria-label="Re-open the setup walkthrough"
            >
              Re-run setup
            </Button>
          </div>
        </section>

        <section aria-label="Capability details">
          <ul className="space-y-2">
            {rows.map((row) => (
              <CapabilityRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CapabilityRow({ row }: { row: Row }) {
  const ok = row.report.available;
  const tone = ok
    ? { dot: "bg-emerald-400", state: "Ready", stateClass: "text-emerald-300" }
    : { dot: "bg-rose-400", state: "Unavailable", stateClass: "text-rose-300" };
  return (
    <li
      // The whole row gets one aria-label so screen-reader users hear the
      // status, the label, and the suggestion together — not three jumpy
      // announcements as focus walks the inner spans.
      className="surface-card border border-surface-border rounded-xl p-3"
      aria-label={`${row.label}: ${tone.state}. ${row.report.available ? row.hint : row.report.reason + " " + row.report.suggestion}`}
    >
      <div className="flex items-start gap-3" aria-hidden="true">
        <span
          className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full ${tone.dot} shadow-[0_0_8px_currentColor]`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="text-stone-50 font-medium">{row.label}</span>
            <span className={`text-sm ${tone.stateClass}`}>{tone.state}</span>
          </div>
          <p className="text-xs text-stone-400 mt-1 leading-relaxed">
            {ok ? row.hint : row.report.reason}
          </p>
          {!ok && row.report.suggestion && (
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              {row.report.suggestion}
            </p>
          )}
          {row.cta && (
            <div className="mt-3">
              <button
                type="button"
                onClick={row.cta.onClick}
                className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-surface-2 hover:bg-surface-3 text-stone-100 border border-surface-border focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
              >
                {row.cta.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// Translate the persisted permission tri-state into the same CapabilityReport
// shape the rest of the page uses, so the row renderer doesn't have to fork
// for permission vs. feature checks.
function permissionToReport(
  state: "granted" | "denied" | "unknown",
  kind: "camera" | "microphone"
): CapabilityReport {
  if (state === "granted") {
    return { available: true, reason: "", suggestion: "" };
  }
  if (state === "denied") {
    return {
      available: false,
      reason: `${kind === "camera" ? "Camera" : "Microphone"} access is blocked.`,
      suggestion: `Re-run setup, or allow ${kind} access for this site in your browser settings.`,
    };
  }
  return {
    available: false,
    reason: `${kind === "camera" ? "Camera" : "Microphone"} access hasn't been granted yet.`,
    suggestion: "Re-run setup to grant access.",
  };
}

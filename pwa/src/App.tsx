import { lazy, Suspense } from "react";
import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { SkipLinks } from "@/core/a11y/SkipLinks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TabBar } from "@/components/TabBar";
import { VoiceFab } from "@/components/VoiceFab";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useRouteAnnounce } from "@/core/hooks/useRouteAnnounce";
import { useGlobalVoiceHotkey } from "@/core/hooks/useGlobalVoiceHotkey";
import { useDarkModeSync } from "@/core/hooks/useDarkModeSync";

// Lazy-loaded module pages — each splits into its own chunk
const HomePage = lazy(() => import("@/pages/HomePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const TroubleshootPage = lazy(() => import("@/pages/TroubleshootPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const TouchExplorerPage = lazy(() => import("@/modules/touch-explorer/TouchExplorerPage"));
const VisionAssistantPage = lazy(() => import("@/modules/ai-vision/VisionAssistantPage"));
const ReaderPage = lazy(() => import("@/modules/reader/ReaderPage"));
const VoiceNavPage = lazy(() => import("@/modules/voice-nav/VoiceNavPage"));
const TactileOutputPage = lazy(() => import("@/modules/tactile-output/TactileOutputPage"));
const TactileDrillPage = lazy(() => import("@/modules/tactile-output/TactileDrillPage"));
const TactileGraphicsPage = lazy(() => import("@/modules/tactile-graphics/TactileGraphicsPage"));
const HardwareEmulatorPage = lazy(() => import("@/modules/tactile-output/HardwareEmulatorPage"));
const DeviceDiagnosticsPage = lazy(() => import("@/pages/DeviceDiagnosticsPage"));
const ResearchPlaygroundPage = lazy(() => import("@/pages/ResearchPlaygroundPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner label="Loading page..." size="lg" />
    </div>
  );
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const location = useLocation();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);

  if (!onboardingComplete) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/onboarding?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const highContrast = useSettingsStore((s) => s.highContrast);

  // Announce route changes to screen readers
  useRouteAnnounce();

  // F6 global hotkey to activate voice commands from any page
  useGlobalVoiceHotkey();

  // Sync high contrast with OS prefers-color-scheme
  useDarkModeSync();

  return (
    <div className={highContrast ? "high-contrast" : ""}>
      <SkipLinks />
      <UpdateBanner />
      <OfflineBanner />
      <main id="main-content" className="pb-nav">
        <ErrorBoundary moduleName="app">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<RequireOnboarding><HomePage /></RequireOnboarding>} />
              <Route path="/settings" element={<RequireOnboarding><SettingsPage /></RequireOnboarding>} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/troubleshoot" element={<RequireOnboarding><TroubleshootPage /></RequireOnboarding>} />
              <Route
                path="/touch-explorer"
                element={
                  <ErrorBoundary moduleName="Touch Explorer">
                    <RequireOnboarding><TouchExplorerPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/ai-vision"
                element={
                  <ErrorBoundary moduleName="AI Vision">
                    <RequireOnboarding><VisionAssistantPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/reader"
                element={
                  <ErrorBoundary moduleName="Accessible Reader">
                    <RequireOnboarding><ReaderPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/voice-nav"
                element={
                  <ErrorBoundary moduleName="Voice Navigation">
                    <RequireOnboarding><VoiceNavPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tactile-output"
                element={
                  <ErrorBoundary moduleName="Tactile Output Lab">
                    <RequireOnboarding><TactileOutputPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tactile-drill"
                element={
                  <ErrorBoundary moduleName="Tactile Drill">
                    <RequireOnboarding><TactileDrillPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tactile-graphics"
                element={
                  <ErrorBoundary moduleName="Tactile Graphics">
                    <RequireOnboarding><TactileGraphicsPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/hardware-emulator"
                element={
                  <ErrorBoundary moduleName="Hardware Emulator">
                    <RequireOnboarding><HardwareEmulatorPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/device-diagnostics"
                element={
                  <ErrorBoundary moduleName="Device Diagnostics">
                    <RequireOnboarding><DeviceDiagnosticsPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/research-playground"
                element={
                  <ErrorBoundary moduleName="Research Playground">
                    <RequireOnboarding><ResearchPlaygroundPage /></RequireOnboarding>
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<RequireOnboarding><NotFoundPage /></RequireOnboarding>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <VoiceFab />
      <TabBar />
    </div>
  );
}

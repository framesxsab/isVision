import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { SkipLinks } from "@/core/a11y/SkipLinks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TabBar } from "@/components/TabBar";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useRouteAnnounce } from "@/core/hooks/useRouteAnnounce";
import { useGlobalVoiceHotkey } from "@/core/hooks/useGlobalVoiceHotkey";
import { useDarkModeSync } from "@/core/hooks/useDarkModeSync";

// Lazy-loaded module pages — each splits into its own chunk
const HomePage = lazy(() => import("@/pages/HomePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const TouchExplorerPage = lazy(() => import("@/modules/touch-explorer/TouchExplorerPage"));
const VisionAssistantPage = lazy(() => import("@/modules/ai-vision/VisionAssistantPage"));
const ReaderPage = lazy(() => import("@/modules/reader/ReaderPage"));
const VoiceNavPage = lazy(() => import("@/modules/voice-nav/VoiceNavPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner label="Loading page..." size="lg" />
    </div>
  );
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
      <OfflineBanner />
      <main id="main-content" className="pb-20">
        <ErrorBoundary moduleName="app">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route
                path="/touch-explorer"
                element={
                  <ErrorBoundary moduleName="Touch Explorer">
                    <TouchExplorerPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/ai-vision"
                element={
                  <ErrorBoundary moduleName="AI Vision">
                    <VisionAssistantPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/reader"
                element={
                  <ErrorBoundary moduleName="Accessible Reader">
                    <ReaderPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/voice-nav"
                element={
                  <ErrorBoundary moduleName="Voice Navigation">
                    <VoiceNavPage />
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <TabBar />
    </div>
  );
}

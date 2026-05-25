import { Routes, Route } from "react-router-dom";
import { SkipLinks } from "@/core/a11y/SkipLinks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TabBar } from "@/components/TabBar";
import HomePage from "@/pages/HomePage";
import SettingsPage from "@/pages/SettingsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import TouchExplorerPage from "@/modules/touch-explorer/TouchExplorerPage";
import VisionAssistantPage from "@/modules/ai-vision/VisionAssistantPage";
import ReaderPage from "@/modules/reader/ReaderPage";
import VoiceNavPage from "@/modules/voice-nav/VoiceNavPage";
import { useSettingsStore } from "@/core/store/settingsStore";

export default function App() {
  const highContrast = useSettingsStore((s) => s.highContrast);

  return (
    <div className={highContrast ? "high-contrast" : ""}>
      <SkipLinks />
      <OfflineBanner />
      <main id="main-content" className="pb-20">
        <ErrorBoundary moduleName="app">
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
          </Routes>
        </ErrorBoundary>
      </main>
      <TabBar />
    </div>
  );
}

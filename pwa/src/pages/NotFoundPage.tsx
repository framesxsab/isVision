import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { IconArrowLeft, IconHome } from "@/components/Icons";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();

  useEffect(() => {
    announce("Page not found");
    speechEngine.speak("Page not found. You can go back or return to the home screen.");
  }, [announce]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto">
      <h1 className="text-6xl font-bold text-gray-600 mb-4" aria-hidden="true">
        404
      </h1>
      <h2 className="text-2xl font-bold text-white mb-2">Page not found</h2>
      <p className="text-gray-400 text-center mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => navigate(-1)} variant="secondary">
          <IconArrowLeft className="w-5 h-5 inline mr-1" /> Go back
        </Button>
        <Button onClick={() => navigate("/")}>
          <IconHome className="w-5 h-5 inline mr-1" /> Home
        </Button>
      </div>
    </div>
  );
}

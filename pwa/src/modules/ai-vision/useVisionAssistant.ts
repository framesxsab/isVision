/**
 * useVisionAssistant — Camera capture → AI description → Speech pipeline.
 *
 * State machine: idle → capturing → analyzing → speaking → idle
 * Uses NVIDIA's free vision API for image description.
 */

import { useState, useCallback, useRef } from "react";
import { describeImage } from "@/core/ai/NvidiaClient";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { earcons } from "@/core/audio/Earcons";
import { useAnnounce } from "@/core/a11y/AriaLive";

type VisionState = "idle" | "capturing" | "analyzing" | "speaking";

interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
}

export function useVisionAssistant() {
  const [state, setState] = useState<VisionState>("idle");
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async (video: HTMLVideoElement) => {
    videoRef.current = video;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      const msg = "Could not access camera. Please grant camera permission.";
      setError(msg);
      speechEngine.interrupt(msg);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureAndDescribe = useCallback(
    async (context?: string) => {
      if (state === "analyzing") return;
      const video = videoRef.current;
      if (!video) return;

      setState("capturing");
      earcons.capture();
      announce("Capturing image");
      speechEngine.interrupt("Capturing image. Please hold still.");

      // Capture frame to canvas
      const canvas = document.createElement("canvas");
      const maxDim = 1024;
      const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      if (!base64) return;

      setState("analyzing");
      announce("Analyzing image");
      speechEngine.interrupt("Analyzing image. One moment please.");

      try {
        const result = await describeImage(base64, context);
        setDescription(result);
        setError(null);

        // Add to history
        const entry: HistoryEntry = {
          id: Date.now().toString(),
          description: result,
          timestamp: Date.now(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, 10));

        setState("speaking");
        earcons.success();
        announce("Description ready");
        speechEngine.interrupt(result);
        setState("idle");
      } catch (err) {
        const msg =
          err instanceof Error
            ? `Error: ${err.message}`
            : "Could not analyze image. Check your internet connection.";
        setError(msg);
        earcons.error();
        setState("idle");
        speechEngine.interrupt(msg);
      }
    },
    [state, announce]
  );

  const describeFromFile = useCallback(
    async (file: File) => {
      setState("analyzing");
      announce("Analyzing uploaded image");
      speechEngine.interrupt("Analyzing uploaded image. One moment please.");

      try {
        const base64 = await fileToBase64(file);
        const result = await describeImage(base64);
        setDescription(result);
        setError(null);

        const entry: HistoryEntry = {
          id: Date.now().toString(),
          description: result,
          timestamp: Date.now(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, 10));

        setState("speaking");
        speechEngine.interrupt(result);
        setState("idle");
      } catch (err) {
        const msg =
          err instanceof Error
            ? `Error: ${err.message}`
            : "Could not analyze image.";
        setError(msg);
        setState("idle");
        speechEngine.interrupt(msg);
      }
    },
    [announce]
  );

  const repeatDescription = useCallback(() => {
    if (description) {
      speechEngine.interrupt(description);
    } else {
      speechEngine.interrupt("No description available. Capture an image first.");
    }
  }, [description]);

  return {
    state,
    description,
    history,
    error,
    startCamera,
    stopCamera,
    captureAndDescribe,
    describeFromFile,
    repeatDescription,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to encode file"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

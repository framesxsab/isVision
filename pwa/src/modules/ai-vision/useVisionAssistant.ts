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
import { useSettingsStore } from "@/core/store/settingsStore";

type VisionState = "idle" | "capturing" | "analyzing" | "speaking";

interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
}

// How long to wait between the "hold still" prompt and the actual frame
// grab. Blind users can't see when the shutter fires, so we need to give
// them a real moment to stabilize the device after they tap capture.
const HOLD_STILL_DELAY_MS = 700;

// Minimum sharpness score (variance of Laplacian) before we accept a frame.
// 10 is deliberately permissive — low-light or low-contrast scenes score
// lower than a brightly-lit desktop. We still pick the sharpest of 3 frames,
// but we don't reject outright unless the image is essentially blank (< 10).
const MIN_SHARPNESS = 10;

export function useVisionAssistant() {
  const [state, setState] = useState<VisionState>("idle");
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureAbortRef = useRef<AbortController | null>(null);
  const retainHistory = useSettingsStore((s) => s.visionRetainHistory);
  // Hold the current retain setting in a ref so capture handlers — which are
  // captured at hook-init time — always see the latest user choice without
  // triggering a useCallback rebuild.
  const retainHistoryRef = useRef(retainHistory);
  retainHistoryRef.current = retainHistory;

  const startCamera = useCallback(async (video: HTMLVideoElement) => {
    videoRef.current = video;

    // Cascade through increasingly permissive constraints. The `min` values
    // in the original code threw OverconstrainedError on portrait mobile because
    // many phones report their smallest supported dimension as width in portrait.
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: true, audio: false },
    ];

    let stream: MediaStream | null = null;
    let lastErr: unknown;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErr = err;
        const name = err instanceof Error ? err.name : "";
        // Only retry on constraint/device errors; permission denial is final.
        if (name === "NotAllowedError" || name === "PermissionDeniedError") break;
      }
    }

    if (!stream) {
      const msg = explainCameraError(lastErr);
      setError(msg);
      speechEngine.interrupt(msg);
      return;
    }

    try {
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      // Wait for the first real frame before allowing capture — without
      // this, videoWidth can be 0 and the canvas comes out empty.
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener("loadeddata", onReady);
            resolve();
          };
          video.addEventListener("loadeddata", onReady);
        });
      }

      // Ask the camera for continuous autofocus where the browser/device
      // supports it. Many laptop webcams default to fixed focus, which is
      // why text in their feed looks soft.
      const track = stream.getVideoTracks()[0];
      if (track && "getCapabilities" in track) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const caps = (track as any).getCapabilities?.() ?? {};
          const wanted: Record<string, unknown> = {};
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
            wanted.focusMode = "continuous";
          }
          if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
            wanted.exposureMode = "continuous";
          }
          if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes("continuous")) {
            wanted.whiteBalanceMode = "continuous";
          }
          if (Object.keys(wanted).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (track as any).applyConstraints?.({ advanced: [wanted] });
          }
        } catch {
          // Constraint application is best-effort — older or restricted
          // browsers throw on advanced constraints. The base stream is
          // still usable, just without continuous AF tuning.
        }
      }
    } catch (err) {
      const msg = explainCameraError(err);
      setError(msg);
      speechEngine.interrupt(msg);
    }
  }, []);

  const stopCamera = useCallback(() => {
    captureAbortRef.current?.abort();
    captureAbortRef.current = null;
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureAndDescribe = useCallback(
    async (context?: string) => {
      if (state === "analyzing" || state === "capturing") return;
      const video = videoRef.current;
      if (!video) return;

      // Refuse to capture an empty frame. Without this check, tapping the
      // shutter before the camera has produced its first frame sends a
      // blank image to the model and gets back "I can't see anything".
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        const msg = "Camera is still warming up. Please wait a moment and try again.";
        setError(msg);
        earcons.error();
        speechEngine.interrupt(msg);
        return;
      }

      setState("capturing");
      setError(null);
      earcons.capture();
      announce("Hold still");
      speechEngine.interrupt("Hold still.");

      // Give the user a real moment to stabilize the device after the
      // "hold still" prompt before we actually grab the frame. Without
      // this delay every photo is taken in mid-motion.
      await new Promise((resolve) => setTimeout(resolve, HOLD_STILL_DELAY_MS));

      // Re-check after the delay — the camera may have stopped, the page
      // may have unmounted, or the user may have navigated away.
      if (!videoRef.current || videoRef.current.readyState < 2) {
        setState("idle");
        return;
      }

      const liveVideo = videoRef.current;
      const frame = await captureSharpFrame(liveVideo);
      if (!frame) {
        const msg =
          "Image was too blurry to use. Please hold the camera steady and try again.";
        setError(msg);
        earcons.error();
        setState("idle");
        speechEngine.interrupt(msg);
        return;
      }

      setState("analyzing");
      announce("Analyzing image");
      speechEngine.interrupt("Analyzing.");

      const abort = new AbortController();
      captureAbortRef.current = abort;

      try {
        const result = await describeImage(frame.base64, context, abort.signal);
        if (abort.signal.aborted) return;

        setDescription(result);
        setError(null);

        const entry: HistoryEntry = {
          id: Date.now().toString(),
          description: result,
          timestamp: Date.now(),
        };
        setHistory((prev) =>
          [entry, ...prev].slice(0, retainHistoryRef.current ? 10 : 1)
        );

        setState("speaking");
        earcons.success();
        announce("Description ready");
        speechEngine.interrupt(result);
        setState("idle");
      } catch (err) {
        if (abort.signal.aborted) return;
        const msg =
          err instanceof Error && err.name === "TimeoutError"
            ? "Vision service took too long. Check your connection and try again."
            : err instanceof Error
              ? `Error: ${err.message}`
              : "Could not analyze image. Check your internet connection.";
        setError(msg);
        earcons.error();
        setState("idle");
        speechEngine.interrupt(msg);
      } finally {
        if (captureAbortRef.current === abort) captureAbortRef.current = null;
      }
    },
    [state, announce]
  );

  const describeFromFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        const msg = "That file is not an image. Please pick a JPEG or PNG.";
        setError(msg);
        speechEngine.interrupt(msg);
        return;
      }

      setState("analyzing");
      setError(null);
      announce("Analyzing uploaded image");
      speechEngine.interrupt("Analyzing uploaded image.");

      const abort = new AbortController();
      captureAbortRef.current = abort;

      try {
        const base64 = await fileToBase64(file);
        if (abort.signal.aborted) return;
        const result = await describeImage(base64, undefined, abort.signal);
        if (abort.signal.aborted) return;
        setDescription(result);
        setError(null);

        const entry: HistoryEntry = {
          id: Date.now().toString(),
          description: result,
          timestamp: Date.now(),
        };
        setHistory((prev) =>
          [entry, ...prev].slice(0, retainHistoryRef.current ? 10 : 1)
        );

        setState("speaking");
        speechEngine.interrupt(result);
        setState("idle");
      } catch (err) {
        if (abort.signal.aborted) return;
        const msg =
          err instanceof Error && err.name === "TimeoutError"
            ? "Vision service took too long. Check your connection and try again."
            : err instanceof Error
              ? `Error: ${err.message}`
              : "Could not analyze image.";
        setError(msg);
        setState("idle");
        speechEngine.interrupt(msg);
      } finally {
        if (captureAbortRef.current === abort) captureAbortRef.current = null;
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

  const clearHistory = useCallback(() => {
    setDescription("");
    setHistory([]);
    setError(null);
    announce("Vision history cleared");
    speechEngine.interrupt("Vision history cleared.");
  }, [announce]);

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
    clearHistory,
  };
}

// Capture up to 3 frames spaced ~150ms apart and return the sharpest one.
// Without this, a single bad-luck frame (mid-blink-of-shutter, AF hunting,
// auto-exposure adjusting) ruins the description even when the user held
// still. We measure sharpness via the variance of the Laplacian on a
// downsampled grayscale crop — a standard motion-blur detector.
async function captureSharpFrame(
  video: HTMLVideoElement
): Promise<{ base64: string; sharpness: number } | null> {
  const maxDim = 1600;
  const scale = Math.min(
    maxDim / video.videoWidth,
    maxDim / video.videoHeight,
    1
  );
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  let best: { base64: string; sharpness: number } | null = null;

  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 150));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;

    ctx.drawImage(video, 0, 0, width, height);
    const sharpness = measureSharpness(ctx, width, height);
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    if (!base64) continue;

    if (!best || sharpness > best.sharpness) {
      best = { base64, sharpness };
    }
  }

  if (!best) return null;
  if (best.sharpness < MIN_SHARPNESS) return null;
  return best;
}

// Variance of the Laplacian on a center crop, downsampled for speed.
// Lower variance = more uniform pixels = blurrier image. This is the
// standard OpenCV technique adapted for canvas pixels.
function measureSharpness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): number {
  const cropSize = Math.min(width, height, 300);
  const cx = Math.floor((width - cropSize) / 2);
  const cy = Math.floor((height - cropSize) / 2);
  const img = ctx.getImageData(cx, cy, cropSize, cropSize);
  const data = img.data;

  // Convert to grayscale into a Float32Array for the Laplacian step.
  const gray = new Float32Array(cropSize * cropSize);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }

  // 4-neighbour Laplacian kernel: center * 4 - up - down - left - right.
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < cropSize - 1; y++) {
    for (let x = 1; x < cropSize - 1; x++) {
      const i = y * cropSize + x;
      const lap =
        4 * gray[i]! -
        gray[i - 1]! -
        gray[i + 1]! -
        gray[i - cropSize]! -
        gray[i + cropSize]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function explainCameraError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Could not access the camera. Please grant camera permission.";
  }
  const name = err.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow camera access in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Please connect a camera and try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is in use by another app. Close that app and try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "The camera does not support the requested resolution. Try a different device.";
  }
  if (name === "SecurityError") {
    return "Camera access is blocked. The page must be served over HTTPS or localhost.";
  }
  return `Could not access the camera: ${err.message}`;
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

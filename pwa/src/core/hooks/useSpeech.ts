import { useCallback, useEffect } from "react";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useSettingsStore } from "@/core/store/settingsStore";

/**
 * React hook wrapper around SpeechEngine.
 * Automatically syncs settings and provides convenient methods.
 */
export function useSpeech() {
  const rate = useSettingsStore((s) => s.speechRate);
  const pitch = useSettingsStore((s) => s.speechPitch);
  const volume = useSettingsStore((s) => s.speechVolume);
  const voiceURI = useSettingsStore((s) => s.voiceURI);

  useEffect(() => {
    speechEngine.init();
    speechEngine.setRate(rate);
    speechEngine.setPitch(pitch);
    speechEngine.setVolume(volume);
    speechEngine.setVoice(voiceURI);
  }, [rate, pitch, volume, voiceURI]);

  const speak = useCallback((text: string) => {
    speechEngine.speak(text);
  }, []);

  const interrupt = useCallback((text: string) => {
    speechEngine.interrupt(text);
  }, []);

  const stop = useCallback(() => {
    speechEngine.stop();
  }, []);

  const pause = useCallback(() => {
    speechEngine.pause();
  }, []);

  const resume = useCallback(() => {
    speechEngine.resume();
  }, []);

  return { speak, interrupt, stop, pause, resume, isSpeaking: speechEngine.speaking };
}

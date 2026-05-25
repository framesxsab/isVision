/** Feature detection utilities */

export const platform = {
  get supportsVibration(): boolean {
    return typeof navigator !== "undefined" && "vibrate" in navigator;
  },

  get supportsSpeechSynthesis(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  get supportsSpeechRecognition(): boolean {
    return (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  },

  get supportsCamera(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "mediaDevices" in navigator &&
      "getUserMedia" in navigator.mediaDevices
    );
  },

  get supportsWebAudio(): boolean {
    return typeof window !== "undefined" && "AudioContext" in window;
  },

  get isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  get isAndroid(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android/.test(navigator.userAgent);
  },

  get isMobile(): boolean {
    return this.isIOS || this.isAndroid;
  },
};

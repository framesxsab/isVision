// First-launch audio gate — runs before the React bundle parses so
// a blind user is not stranded in silence while ~100kb of JS loads.
// Browsers (especially iOS Safari) only unlock speechSynthesis after
// a user gesture, so we render a "Tap anywhere" affordance and speak
// the welcome on first interaction. Gated by sessionStorage so it
// appears once per browser session.
(function () {
  try {
    // Skip under browser automation (Playwright, etc.) — the modal blocks
    // pointer events and would break every test, and automated runs don't
    // need the speechSynthesis unlock gesture.
    if (navigator.webdriver) return;
    if (sessionStorage.getItem("isvisible.welcomed") === "1") return;
    var host = document.getElementById("prelaunch-audio");
    if (!host) return;
    host.hidden = false;
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", "Welcome to isVisible");
    host.style.cssText =
      "position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:#0c0a09;color:#fafaf9;font-family:system-ui,-apple-system,sans-serif;cursor:pointer;";
    host.innerHTML =
      '<div style="max-width:28rem;text-align:center;">' +
      '<div style="font-size:1.75rem;font-weight:700;letter-spacing:-0.02em;margin-bottom:0.75rem;">isVisible</div>' +
      '<p style="font-size:1.1rem;line-height:1.5;color:#d6d3d1;margin:0 0 1.25rem;">Tap anywhere to begin. You will hear a welcome message.</p>' +
      '<button type="button" id="prelaunch-tap" autofocus aria-label="Begin and hear welcome" style="min-height:48px;padding:0.75rem 1.5rem;border-radius:0.75rem;border:1px solid #4f46e5;background:#4338ca;color:#fff;font-size:1rem;font-weight:600;cursor:pointer;">Tap to begin</button>' +
      "</div>";
    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      try { sessionStorage.setItem("isvisible.welcomed", "1"); } catch (_) {}
      try {
        if ("speechSynthesis" in window) {
          var u = new SpeechSynthesisUtterance(
            "Welcome to isVisible. Loading your accessible workspace."
          );
          u.rate = 1.0;
          u.pitch = 1.0;
          u.volume = 1.0;
          window.speechSynthesis.speak(u);
        }
      } catch (_) {}
      host.style.opacity = "0";
      host.style.transition = "opacity 200ms";
      setTimeout(function () { host.remove(); }, 220);
    }
    host.addEventListener("click", dismiss, { once: true });
    host.addEventListener("touchstart", dismiss, { once: true, passive: true });
    // Keyboard path — any key on the focused button dismisses too.
    host.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Tab") {
        e.preventDefault();
        dismiss();
      }
    });
  } catch (_) {
    // Never block the app on a welcome screen failure.
  }
})();

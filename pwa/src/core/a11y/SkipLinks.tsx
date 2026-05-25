export function SkipLinks() {
  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-50 bg-primary-600 text-white px-4 py-3 rounded-lg text-lg font-semibold focus:not-sr-only"
      >
        Skip to main content
      </a>
    </nav>
  );
}

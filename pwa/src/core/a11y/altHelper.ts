export function ensureAlt(img: HTMLImageElement, fallback = "Image without description"): string {
  if (img.alt && img.alt.trim()) return img.alt;
  img.alt = fallback;
  return fallback;
}

export function getAltText(src: string | null, alt: string | null): string {
  if (alt && alt.trim()) return alt;
  if (!src) return "Image";
  try {
    const name = new URL(src, location.origin).pathname.split("/").pop() ?? "";
    return name ? `Image: ${name}` : "Image";
  } catch {
    return "Image";
  }
}

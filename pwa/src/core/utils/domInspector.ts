/**
 * DOM Inspector — Identifies elements at screen coordinates and extracts
 * their accessibility role and bounds for the Touch Explorer.
 */

/** Get the DOM element at the given screen coordinates. */
export function getElementAt(x: number, y: number): Element | null {
  return document.elementFromPoint(x, y);
}

/** Get the bounding rectangle of an element. */
export function getElementBounds(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

/** Tag-to-role mapping for elements without explicit ARIA roles. */
const TAG_ROLE_MAP: Record<string, string> = {
  a: "link",
  button: "button",
  input: "textbox",
  textarea: "textbox",
  select: "combobox",
  img: "image",
  nav: "navigation",
  main: "main",
  header: "banner",
  footer: "contentinfo",
  aside: "complementary",
  form: "form",
  table: "table",
  ul: "list",
  ol: "list",
  li: "listitem",
  section: "region",
  article: "article",
  dialog: "dialog",
  progress: "progressbar",
  meter: "meter",
};

/**
 * Get the effective accessibility role of an element.
 * Checks explicit `role` attribute first, then maps from tag name.
 */
export function getElementRole(el: Element): string {
  // Explicit ARIA role takes priority
  const explicitRole = el.getAttribute("role");
  if (explicitRole) return explicitRole;

  const tag = el.tagName.toLowerCase();

  // Heading levels
  const headingMatch = tag.match(/^h([1-6])$/);
  if (headingMatch) return `heading`;

  // Input types
  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    switch (type) {
      case "checkbox":
        return "checkbox";
      case "radio":
        return "radio";
      case "range":
        return "slider";
      case "submit":
      case "button":
      case "reset":
        return "button";
      case "search":
        return "searchbox";
      default:
        return "textbox";
    }
  }

  return TAG_ROLE_MAP[tag] ?? "text";
}

/** Get the heading level (1-6) or 0 if not a heading. */
export function getHeadingLevel(el: Element): number {
  const tag = el.tagName.toLowerCase();
  const match = tag.match(/^h([1-6])$/);
  if (match) return parseInt(match[1]!, 10);

  const ariaLevel = el.getAttribute("aria-level");
  if (ariaLevel && el.getAttribute("role") === "heading") {
    return parseInt(ariaLevel, 10);
  }
  return 0;
}

/** Get accessible name for an element (label, aria-label, text content, alt, etc.). */
export function getAccessibleName(el: Element): string {
  // aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() ?? "";
  }

  // img alt
  if (el.tagName.toLowerCase() === "img") {
    const alt = (el as HTMLImageElement).alt;
    return alt || "no description";
  }

  // input: associated label or placeholder
  if (el.tagName.toLowerCase() === "input" || el.tagName.toLowerCase() === "textarea") {
    const input = el as HTMLInputElement;
    // Check for associated <label>
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent?.trim() ?? "";
    }
    if (input.placeholder) return input.placeholder;
    return input.type || "text input";
  }

  // Text content (limited length)
  const text = el.textContent?.trim() ?? "";
  if (text.length > 100) return text.slice(0, 100) + "...";
  return text || el.tagName.toLowerCase();
}

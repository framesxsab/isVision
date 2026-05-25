/**
 * Element Describer — Generates human-readable spoken descriptions
 * of DOM elements for the Touch Explorer.
 *
 * Output format: "Role: Name" or "Role level N: Name"
 * Examples:
 *   "Button: Submit form"
 *   "Heading level 2: Getting Started"
 *   "Image: A sunset over mountains"
 *   "Link: Read more about accessibility"
 *   "Text field: Enter your email, required"
 */

import { getElementRole, getHeadingLevel, getAccessibleName } from "./domInspector";

export function describeElement(el: Element): string {
  const role = getElementRole(el);
  const name = getAccessibleName(el);
  const headingLevel = getHeadingLevel(el);

  // Build the role label
  let roleLabel: string;
  if (headingLevel > 0) {
    roleLabel = `Heading level ${headingLevel}`;
  } else {
    roleLabel = formatRole(role);
  }

  // Add state information
  const states = getElementStates(el);
  const stateStr = states.length > 0 ? `, ${states.join(", ")}` : "";

  if (!name || name === el.tagName.toLowerCase()) {
    return `${roleLabel}${stateStr}`;
  }

  return `${roleLabel}: ${name}${stateStr}`;
}

function formatRole(role: string): string {
  const roleNames: Record<string, string> = {
    link: "Link",
    button: "Button",
    textbox: "Text field",
    searchbox: "Search field",
    checkbox: "Checkbox",
    radio: "Radio button",
    slider: "Slider",
    combobox: "Dropdown",
    image: "Image",
    heading: "Heading",
    navigation: "Navigation",
    main: "Main content",
    banner: "Banner",
    contentinfo: "Footer",
    complementary: "Sidebar",
    form: "Form",
    list: "List",
    listitem: "List item",
    article: "Article",
    region: "Section",
    dialog: "Dialog",
    progressbar: "Progress bar",
    meter: "Meter",
    table: "Table",
    text: "Text",
  };
  return roleNames[role] ?? role;
}

function getElementStates(el: Element): string[] {
  const states: string[] = [];

  // Disabled
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
    states.push("disabled");
  }

  // Required
  if (el.hasAttribute("required") || el.getAttribute("aria-required") === "true") {
    states.push("required");
  }

  // Checked state (checkbox/radio)
  if (el.tagName.toLowerCase() === "input") {
    const input = el as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") {
      states.push(input.checked ? "checked" : "not checked");
    }
  }

  // Expanded
  const expanded = el.getAttribute("aria-expanded");
  if (expanded !== null) {
    states.push(expanded === "true" ? "expanded" : "collapsed");
  }

  // Selected
  if (el.getAttribute("aria-selected") === "true") {
    states.push("selected");
  }

  // Current value for range inputs
  if (el.tagName.toLowerCase() === "input" && (el as HTMLInputElement).type === "range") {
    states.push(`value ${(el as HTMLInputElement).value}`);
  }

  return states;
}

export type Shortcut = { key: string; description: string; action: () => void };

const registry = new Map<string, Shortcut>();

export function registerShortcut(key: string, description: string, action: () => void) {
  registry.set(key.toLowerCase(), { key, description, action });
}

export function getShortcuts(): Shortcut[] {
  return Array.from(registry.values());
}

export function handleShortcut(e: KeyboardEvent) {
  const hit = registry.get(e.key.toLowerCase());
  if (hit && !isTypingTarget(e.target)) {
    e.preventDefault();
    hit.action();
  }
}

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  return ["input", "select", "textarea"].includes(t.tagName.toLowerCase()) || t.isContentEditable;
}

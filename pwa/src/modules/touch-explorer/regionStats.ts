/**
 * regionStats — Shared metadata + counting for the Touch Explorer
 * region legend and performance overlay.
 */

import { getElementRole } from "@/core/utils/domInspector";

export interface RegionTypeMeta {
  role: string;
  label: string;
  pluralLabel: string;
  /** Tailwind classes for the colour chip — distinct hue per role. */
  chipClass: string;
  /** Single-glyph tactile/visual marker, announced by screen readers. */
  glyph: string;
}

export const REGION_TYPES: readonly RegionTypeMeta[] = [
  {
    role: "heading",
    label: "Heading",
    pluralLabel: "Headings",
    chipClass: "bg-amber-400",
    glyph: "H",
  },
  {
    role: "link",
    label: "Link",
    pluralLabel: "Links",
    chipClass: "bg-sky-400",
    glyph: "L",
  },
  {
    role: "button",
    label: "Button",
    pluralLabel: "Buttons",
    chipClass: "bg-primary-400",
    glyph: "B",
  },
  {
    role: "image",
    label: "Image",
    pluralLabel: "Images",
    chipClass: "bg-emerald-400",
    glyph: "I",
  },
] as const;

export interface RegionCount {
  meta: RegionTypeMeta;
  count: number;
}

export function countRegions(root: HTMLElement | null): RegionCount[] {
  if (!root) return REGION_TYPES.map((meta) => ({ meta, count: 0 }));

  const counts = new Map<string, number>(
    REGION_TYPES.map((meta) => [meta.role, 0])
  );

  for (const el of Array.from(root.querySelectorAll("*"))) {
    const role = getElementRole(el);
    const current = counts.get(role);
    if (current !== undefined) counts.set(role, current + 1);
  }

  return REGION_TYPES.map((meta) => ({ meta, count: counts.get(meta.role) ?? 0 }));
}

export function totalRegionCount(counts: RegionCount[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}

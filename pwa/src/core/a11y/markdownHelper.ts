export function sanitizeMarkdownHeadings(markdown: string): string {
  return markdown.replace(/^#{1,6}\s/gm, (m) => m);
}

export function headingToId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

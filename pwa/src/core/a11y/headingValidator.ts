export type HeadingIssue = {
  level: number;
  text: string;
  message: string;
};

export function validateHeadings(root: ParentNode = document): HeadingIssue[] {
  const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  const issues: HeadingIssue[] = [];
  let lastLevel = 0;

  for (const el of headings) {
    const level = parseInt(el.tagName[1]!, 10);
    const text = (el.textContent ?? "").trim().slice(0, 80);

    if (lastLevel === 0 && level !== 1) {
      issues.push({ level, text, message: "First heading should be h1" });
    } else if (level > lastLevel + 1) {
      issues.push({ level, text, message: `Skipped h${lastLevel + 1}` });
    }

    lastLevel = level;
  }

  const h1Count = headings.filter((h) => h.tagName === "H1").length;
  if (h1Count !== 1) {
    issues.push({ level: 1, text: `${h1Count} h1 found`, message: "Exactly one h1 per page" });
  }

  return issues;
}

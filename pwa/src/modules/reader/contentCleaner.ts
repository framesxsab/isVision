/**
 * Content Cleaner — Extracts readable content from raw HTML.
 * Strips scripts, styles, ads, and navigation chrome.
 * Produces clean, accessible semantic HTML.
 */

/** Extract the main readable content from an HTML string. */
export function cleanContent(html: string, baseUrl?: string): {
  title: string;
  content: string;
  textContent: string;
  headings: Array<{ level: number; text: string; id: string }>;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove unwanted elements
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "header:not(article header)",
    "footer:not(article footer)",
    ".ad",
    ".ads",
    ".advertisement",
    ".sidebar",
    ".cookie-banner",
    ".popup",
    "[aria-hidden='true']",
  ];

  for (const selector of removeSelectors) {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // Try to find the main article content
  const article =
    doc.querySelector("article") ??
    doc.querySelector("[role='main']") ??
    doc.querySelector("main") ??
    doc.querySelector(".post-content") ??
    doc.querySelector(".entry-content") ??
    doc.querySelector(".article-body") ??
    doc.body;

  // Get title
  const title =
    doc.querySelector("h1")?.textContent?.trim() ??
    doc.querySelector("title")?.textContent?.trim() ??
    "Untitled";

  // Process images: ensure alt text
  article.querySelectorAll("img").forEach((img) => {
    if (!img.alt) {
      img.alt = "Image without description";
    }
    // Convert relative URLs to absolute
    if (baseUrl && img.src && !img.src.startsWith("http")) {
      try {
        img.src = new URL(img.src, baseUrl).href;
      } catch {
        // Leave as-is if URL parsing fails
      }
    }
  });

  // Add IDs to headings for navigation
  const headings: Array<{ level: number; text: string; id: string }> = [];
  article.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading, i) => {
    const id = `heading-${i}`;
    heading.id = id;
    const level = parseInt(heading.tagName[1]!, 10);
    headings.push({ level, text: heading.textContent?.trim() ?? "", id });
  });

  // Convert relative links to absolute
  if (baseUrl) {
    article.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("#")) {
        try {
          link.setAttribute("href", new URL(href, baseUrl).href);
        } catch {
          // Leave as-is
        }
      }
    });
  }

  return {
    title,
    content: article.innerHTML,
    textContent: article.textContent?.trim() ?? "",
    headings,
  };
}

/**
 * Split text into speakable chunks at sentence boundaries.
 * Keeps chunks under ~200 characters to avoid Chrome mobile TTS bug.
 */
export function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= 200) {
      chunks.push(para.trim());
      continue;
    }

    // Split at sentence boundaries
    const sentences = para.match(/[^.!?]+[.!?]+\s*/g) ?? [para];
    let current = "";

    for (const sentence of sentences) {
      if (current.length + sentence.length > 200 && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }
  }

  return chunks;
}

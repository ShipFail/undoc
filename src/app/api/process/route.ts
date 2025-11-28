import { NextRequest, NextResponse } from "next/server";

interface Section {
  title: string;
  content: string;
  type: "overview" | "quickstart" | "key-concepts" | "api-reference" | "examples" | "troubleshooting";
}

interface ProcessedDoc {
  title: string;
  summary: string;
  sections: Section[];
  keyTakeaways: string[];
  originalUrl: string;
}

// Decode HTML entities safely
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };
  
  let result = text;
  // Decode &amp; last to avoid double-decoding issues
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }
  // Decode &amp; separately to avoid double-unescaping
  result = result.split("&amp;").join("&");
  
  return result;
}

// Simple HTML to text parser (no external dependencies)
// 
// SECURITY NOTE: This function extracts text content from HTML for display.
// The output is rendered via React's JSX interpolation (e.g., {text}), which
// automatically escapes HTML entities. This means even if some HTML remnants 
// remain, they will be displayed as literal text, not interpreted as HTML.
// The final escapeHtmlCharacters step provides defense-in-depth.
function htmlToText(html: string): string {
  let text = html;
  
  // Repeatedly remove script and style elements until none remain.
  // This handles nested, malformed, or escaped tags.
  // Using a loop ensures complete removal even if the first pass leaves fragments.
  const MAX_ITERATIONS = 100; // Prevent infinite loops on malicious input
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const prevText = text;
    
    // Remove script elements (handles various whitespace in closing tags)
    text = text.replace(/<script\b[\s\S]*?<\/script[\s\S]*?>/gi, "");
    
    // Remove style elements
    text = text.replace(/<style\b[\s\S]*?<\/style[\s\S]*?>/gi, "");
    
    // Remove orphaned opening script/style tags (no closing tag found)
    text = text.replace(/<script\b[^>]*>/gi, "");
    text = text.replace(/<style\b[^>]*>/gi, "");
    
    // Remove orphaned closing script/style tags
    text = text.replace(/<\/script[\s\S]*?>/gi, "");
    text = text.replace(/<\/style[\s\S]*?>/gi, "");
    
    // If no changes were made, we're done
    if (text === prevText) break;
  }
  
  // Replace line breaks with newlines
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n");
  
  // Remove all remaining HTML tags (for text extraction)
  text = text.replace(/<[^>]*>/g, "");
  
  // Decode HTML entities
  text = decodeHtmlEntities(text);
  
  // Defense-in-depth: escape any remaining angle brackets that might look like HTML
  // This ensures that even if regex-based tag removal missed something,
  // the output cannot be interpreted as HTML
  text = escapeHtmlCharacters(text);
  
  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  
  return text;
}

// Escape HTML-significant characters to prevent any possibility of HTML injection
// even though React already escapes text in JSX interpolation
function escapeHtmlCharacters(text: string): string {
  return text
    .replace(/</g, "‹") // Replace with single angle quotation mark
    .replace(/>/g, "›"); // This preserves readability while preventing HTML interpretation
}

// Extract title from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) {
    return htmlToText(titleMatch[1]).trim();
  }
  
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    return htmlToText(h1Match[1]).trim();
  }
  
  return "Documentation";
}

// Extract main content from HTML
function extractMainContent(html: string): string {
  // Try to find main content area
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*markdown[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match) {
      return htmlToText(match[1]);
    }
  }
  
  // Fall back to body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return htmlToText(bodyMatch[1]);
  }
  
  return htmlToText(html);
}

// Extract headings and their content
function extractSections(html: string): Section[] {
  const sections: Section[] = [];
  const content = extractMainContent(html);
  const lines = content.split("\n");
  
  // Process the content and group by sections
  let currentSection: { title: string; content: string[] } | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check if this looks like a heading (short, possibly all caps or title case)
    const isHeading = trimmedLine.length < 100 && 
      !trimmedLine.endsWith(".") &&
      (trimmedLine === trimmedLine.toUpperCase() || 
       /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedLine) ||
       /^#{1,3}\s/.test(trimmedLine));
    
    if (isHeading && trimmedLine.length > 2) {
      if (currentSection && currentSection.content.length > 0) {
        sections.push(createSection(currentSection.title, currentSection.content.join("\n")));
      }
      currentSection = { title: trimmedLine.replace(/^#+\s*/, ""), content: [] };
    } else if (currentSection) {
      currentSection.content.push(trimmedLine);
    } else {
      currentSection = { title: "Overview", content: [trimmedLine] };
    }
  }
  
  if (currentSection && currentSection.content.length > 0) {
    sections.push(createSection(currentSection.title, currentSection.content.join("\n")));
  }
  
  // If no sections were found, create a single overview section
  if (sections.length === 0) {
    sections.push({
      title: "Overview",
      content: content.substring(0, 2000) + (content.length > 2000 ? "..." : ""),
      type: "overview"
    });
  }
  
  return sections.slice(0, 8); // Limit to 8 sections
}

function createSection(title: string, content: string): Section {
  const titleLower = title.toLowerCase();
  
  let type: Section["type"] = "overview";
  
  if (titleLower.includes("quick") || titleLower.includes("start") || titleLower.includes("getting started")) {
    type = "quickstart";
  } else if (titleLower.includes("concept") || titleLower.includes("fundamentals") || titleLower.includes("basics")) {
    type = "key-concepts";
  } else if (titleLower.includes("api") || titleLower.includes("reference") || titleLower.includes("endpoint")) {
    type = "api-reference";
  } else if (titleLower.includes("example") || titleLower.includes("tutorial") || titleLower.includes("guide")) {
    type = "examples";
  } else if (titleLower.includes("trouble") || titleLower.includes("error") || titleLower.includes("debug") || titleLower.includes("faq")) {
    type = "troubleshooting";
  }
  
  return {
    title,
    content: content.substring(0, 1500) + (content.length > 1500 ? "..." : ""),
    type
  };
}

// Generate summary from content
function generateSummary(content: string, title: string): string {
  // Take first few sentences that seem relevant
  const sentences = content
    .split(/[.!?]/)
    .filter(s => s.trim().length > 20)
    .slice(0, 3)
    .map(s => s.trim());
  
  if (sentences.length > 0) {
    return sentences.join(". ") + ".";
  }
  
  return `Documentation for ${title}. This page has been simplified for easier reading.`;
}

// Extract key takeaways
function extractKeyTakeaways(content: string): string[] {
  const takeaways: string[] = [];
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Look for important-looking statements
    if (trimmed.length > 30 && trimmed.length < 200) {
      if (
        trimmed.includes("important") ||
        trimmed.includes("note:") ||
        trimmed.includes("remember") ||
        trimmed.includes("must") ||
        trimmed.includes("should") ||
        trimmed.includes("recommended") ||
        /^\d+\.\s/.test(trimmed) ||
        /^[-*]\s/.test(trimmed)
      ) {
        takeaways.push(trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));
        if (takeaways.length >= 5) break;
      }
    }
  }
  
  // If we couldn't find explicit takeaways, extract key sentences
  if (takeaways.length === 0) {
    const sentences = content
      .split(/[.!]/)
      .filter(s => s.trim().length > 40 && s.trim().length < 200)
      .slice(0, 3);
    
    for (const sentence of sentences) {
      takeaways.push(sentence.trim());
    }
  }
  
  return takeaways.slice(0, 5);
}

// URL validation helper
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "Invalid URL format. Please provide a valid HTTP or HTTPS URL." },
        { status: 400 }
      );
    }

    // Fetch the documentation page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "UnDoc/1.0 (Documentation Simplifier)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch documentation: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    
    // Process the HTML
    const title = extractTitle(html);
    const content = extractMainContent(html);
    const sections = extractSections(html);
    const summary = generateSummary(content, title);
    const keyTakeaways = extractKeyTakeaways(content);

    const processedDoc: ProcessedDoc = {
      title,
      summary,
      sections,
      keyTakeaways,
      originalUrl: url,
    };

    return NextResponse.json(processedDoc);
  } catch (error) {
    console.error("Error processing documentation:", error);
    return NextResponse.json(
      { error: "Failed to process documentation. Please check the URL and try again." },
      { status: 500 }
    );
  }
}

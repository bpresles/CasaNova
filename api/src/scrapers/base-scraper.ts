import axios from "axios";
import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import robotsParser from "robots-parser";
import type { FetchResult, FetchOptions, ExtractedLink } from "../types/index.js";

const USER_AGENT =
  "CasaNova-Bot/1.0 (International Mobility Info Aggregator; contact@casanova.app)";

// Rate limiting: minimum delay between requests to same domain
const RATE_LIMIT_MS = 2000;
const lastRequestTime = new Map<string, number>();

async function respectRateLimit(domain: string): Promise<void> {
  const now = Date.now();
  const lastRequest = lastRequestTime.get(domain) || 0;
  const timeSinceLastRequest = now - lastRequest;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
  }

  lastRequestTime.set(domain, Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

    const response = await axios.get(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 5000,
    });

    const robots = robotsParser(robotsUrl, response.data);
    return robots.isAllowed(url, USER_AGENT) ?? true;
  } catch {
    // If we can't fetch robots.txt, assume allowed but be cautious
    return true;
  }
}

export async function fetchPage(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const urlObj = new URL(url);
  const domain = urlObj.host;

  // Check robots.txt
  const allowed = await checkRobotsTxt(url);
  if (!allowed) {
    throw new Error(`Scraping not allowed by robots.txt: ${url}`);
  }

  // Respect rate limit
  await respectRateLimit(domain);

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": options.language || "en-US,en;q=0.5,fr;q=0.3",
        ...options.headers,
      },
      timeout: options.timeout || 30000,
      maxRedirects: 5,
    });

    return {
      html: response.data,
      $: cheerio.load(response.data),
      status: response.status,
      url: (response.request?.res?.responseUrl as string) || url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch ${url}: ${message}`);
  }
}

export function extractText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $element: Cheerio<any> | string | undefined
): string | null {
  if (!$element) return null;
  if (typeof $element === "string") {
    return $element.trim().replace(/\s+/g, " ") || null;
  }
  if ($element.length === 0) return null;
  return $element.text().trim().replace(/\s+/g, " ");
}

export function extractLinks(
  $: CheerioAPI,
  selector: string,
  baseUrl: string
): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  $(selector).each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        const absoluteUrl = new URL(href, baseUrl).toString();
        links.push({
          url: absoluteUrl,
          text: extractText($(el)),
        });
      } catch {
        // Invalid URL, skip
      }
    }
  });
  return links;
}

export function cleanText(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
}

export function extractListItems($: CheerioAPI, selector: string): string[] {
  const items: string[] = [];
  $(selector).each((_, el) => {
    const text = extractText($(el));
    if (text) items.push(text);
  });
  return items;
}

export abstract class BaseScraper {
  protected name: string;
  protected baseUrl: string;

  constructor(name: string, baseUrl: string) {
    this.name = name;
    this.baseUrl = baseUrl;
  }

  abstract scrape(): Promise<unknown>;

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  protected error(message: string): void {
    console.error(`[${this.name}] ERROR: ${message}`);
  }
}

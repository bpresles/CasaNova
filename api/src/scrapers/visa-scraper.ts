import type { CheerioAPI, Cheerio } from "cheerio";
import {
  BaseScraper,
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "./base-scraper.js";
import { getDb, logScrape } from "../db/database.js";
import type { Source, SourceMap, VisaInfo, ScrapeResult } from "../types/index.js";
import visaSources from "../sources/visa-sources.json" with { type: "json" };

const sources: SourceMap = visaSources;

export class VisaScraper extends BaseScraper {
  constructor() {
    super("VisaScraper", "https://www.visahq.com");
  }

  async scrape(): Promise<ScrapeResult[]> {
    return scrapeAllVisaInfo();
  }

  async scrapeCountry(countryCode: string): Promise<VisaInfo[]> {
    const db = getDb();
    const countrySources = this.getSourcesForCountry(countryCode);
    const results: VisaInfo[] = [];

    for (const source of countrySources) {
      try {
        this.log(`Scraping ${source.name} for ${countryCode}...`);
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        logScrape(source.name, source.url, "success", data.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        this.error(`Failed to scrape ${source.name}: ${message}`);
        logScrape(source.name, source.url, "error", 0, message);
      }
    }

    // Store results in database
    for (const item of results) {
      this.saveVisaInfo(db, item);
    }

    return results;
  }

  getSourcesForCountry(countryCode: string): Source[] {
    return sources[countryCode] || [];
  }

  async scrapeSource(source: Source, countryCode: string): Promise<VisaInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: VisaInfo[] = [];

    // Extract visa information sections
    $("article, .content-section, .visa-info, section").each((_, section) => {
      const $section = $(section);
      const title = extractText($section.find("h1, h2, h3").first());

      if (title) {
        const description = extractText($section.find("p").first());
        const requirements = extractListItems($, "ul li, ol li");

        if (title || description) {
          results.push({
            country_code: countryCode,
            visa_type: this.inferVisaType(title),
            title: title || "General Visa Information",
            description: cleanText(description),
            requirements:
              requirements.length > 0 ? JSON.stringify(requirements) : null,
            processing_time: this.extractProcessingTime($section, $),
            cost: this.extractCost($section, $),
            validity: this.extractValidity($section, $),
            source_url: url,
            source_name: source.name,
            language: "en",
          });
        }
      }
    });

    // If no structured content found, create a basic entry
    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      results.push({
        country_code: countryCode,
        visa_type: "general",
        title: pageTitle || `Visa Information for ${countryCode}`,
        description: cleanText(pageDescription),
        requirements: null,
        processing_time: null,
        cost: null,
        validity: null,
        source_url: url,
        source_name: source.name,
        language: "en",
      });
    }

    return results;
  }

  inferVisaType(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();

    if (lowerText.includes("tourist") || lowerText.includes("visitor"))
      return "tourist";
    if (lowerText.includes("work") || lowerText.includes("employment"))
      return "work";
    if (lowerText.includes("student") || lowerText.includes("study"))
      return "student";
    if (lowerText.includes("business")) return "business";
    if (lowerText.includes("transit")) return "transit";
    if (lowerText.includes("family") || lowerText.includes("spouse"))
      return "family";
    if (lowerText.includes("permanent") || lowerText.includes("residence"))
      return "residence";

    return "general";
  }

  extractProcessingTime(
    $section: Cheerio<any>,
    _$: CheerioAPI
  ): string | null {
    const text = $section.text().toLowerCase();
    const patterns = [
      /(\d+)\s*(?:to|-)\s*(\d+)\s*(?:business\s+)?days?/i,
      /(\d+)\s*(?:business\s+)?days?/i,
      /(\d+)\s*(?:to|-)\s*(\d+)\s*weeks?/i,
      /(\d+)\s*weeks?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  extractCost($section: Cheerio<any>, _$: CheerioAPI): string | null {
    const text = $section.text();
    const patterns = [
      /[€$£]\s*\d+(?:[.,]\d{2})?/,
      /\d+(?:[.,]\d{2})?\s*(?:EUR|USD|GBP)/i,
      /(?:fee|cost|price)(?:\s*:)?\s*[€$£]?\s*\d+/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  extractValidity($section: Cheerio<any>, _$: CheerioAPI): string | null {
    const text = $section.text().toLowerCase();
    const patterns = [
      /valid(?:ity)?(?:\s*:)?\s*(\d+)\s*(?:months?|years?|days?)/i,
      /(\d+)\s*(?:months?|years?)\s*validity/i,
      /up\s*to\s*(\d+)\s*(?:months?|years?|days?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  saveVisaInfo(db: ReturnType<typeof getDb>, item: VisaInfo): void {
    const stmt = db.prepare(`
      INSERT INTO visa_info (
        country_code, visa_type, title, description, requirements,
        processing_time, cost, validity, source_url, source_name, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.country_code,
      item.visa_type,
      item.title,
      item.description,
      item.requirements,
      item.processing_time,
      item.cost,
      item.validity,
      item.source_url,
      item.source_name,
      item.language
    );
  }
}

export async function scrapeVisaForCountry(
  countryCode: string
): Promise<VisaInfo[]> {
  const scraper = new VisaScraper();
  return scraper.scrapeCountry(countryCode);
}

export async function scrapeAllVisaInfo(): Promise<ScrapeResult[]> {
  const db = getDb();
  const countries = db
    .prepare("SELECT code FROM countries")
    .all() as { code: string }[];
  const scraper = new VisaScraper();

  const results: ScrapeResult[] = [];
  for (const country of countries) {
    try {
      const data = await scraper.scrapeCountry(country.code);
      results.push({ country: country.code, count: data.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to scrape visa info for ${country.code}: ${message}`);
    }
  }

  return results;
}

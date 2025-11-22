import type { CheerioAPI, Cheerio } from "cheerio";
import {
  BaseScraper,
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "./base-scraper.js";
import { getDb, logScrape } from "../db/database.js";
import type { Source, SourceMap, BankingInfo, ScrapeResult } from "../types/index.js";
import bankingSources from "../sources/banking-sources.json" with { type: "json" };

const sources: SourceMap = bankingSources;

export class BankingScraper extends BaseScraper {
  constructor() {
    super("BankingScraper", "https://www.expatica.com");
  }

  async scrape(): Promise<ScrapeResult[]> {
    return scrapeAllBankingInfo();
  }

  async scrapeCountry(countryCode: string): Promise<BankingInfo[]> {
    const db = getDb();
    const countrySources = this.getSourcesForCountry(countryCode);
    const results: BankingInfo[] = [];

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

    for (const item of results) {
      this.saveBankingInfo(db, item);
    }

    return results;
  }

  getSourcesForCountry(countryCode: string): Source[] {
    return sources[countryCode] || [];
  }

  async scrapeSource(source: Source, countryCode: string): Promise<BankingInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: BankingInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each(
      (_, section) => {
        const $section = $(section);
        const title = extractText($section.find("h1, h2, h3, .title").first());

        if (title && this.isBankingRelated(title)) {
          const description = extractText($section.find("p").first());
          const tips = extractListItems($, "ul li, ol li");

          results.push({
            country_code: countryCode,
            category: this.inferCategory(title),
            title: title,
            description: cleanText(description),
            account_requirements: this.extractRequirements($section, $),
            recommended_banks: this.extractBanks($section, $),
            tips: tips.length > 0 ? JSON.stringify(tips) : null,
            source_url: url,
            source_name: source.name,
            language: "en",
          });
        }
      }
    );

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      results.push({
        country_code: countryCode,
        category: "general",
        title: pageTitle || `Banking Information for ${countryCode}`,
        description: cleanText(pageDescription),
        account_requirements: null,
        recommended_banks: null,
        tips: null,
        source_url: url,
        source_name: source.name,
        language: "en",
      });
    }

    return results;
  }

  isBankingRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = [
      "bank",
      "account",
      "finance",
      "money",
      "transfer",
      "payment",
      "credit",
      "debit",
      "savings",
    ];
    const lowerText = text.toLowerCase();
    return keywords.some((kw) => lowerText.includes(kw));
  }

  inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();

    if (lowerText.includes("account")) return "accounts";
    if (lowerText.includes("transfer")) return "transfers";
    if (lowerText.includes("credit")) return "credit";
    if (lowerText.includes("savings")) return "savings";
    if (lowerText.includes("tax")) return "taxes";
    if (lowerText.includes("investment")) return "investment";

    return "general";
  }

  extractRequirements($section: Cheerio<any>, _$: CheerioAPI): string | null {
    const requirements: string[] = [];
    const reqKeywords = [
      "passport",
      "id",
      "proof of address",
      "proof of income",
      "residence permit",
      "tax number",
      "social security",
    ];

    const text = $section.text().toLowerCase();
    for (const req of reqKeywords) {
      if (text.includes(req)) {
        requirements.push(req);
      }
    }

    return requirements.length > 0 ? JSON.stringify(requirements) : null;
  }

  extractBanks($section: Cheerio<any>, _$: CheerioAPI): string | null {
    const banks: string[] = [];
    // Common banks by region
    const knownBanks = [
      "BNP Paribas",
      "Societe Generale",
      "Credit Agricole",
      "HSBC",
      "Deutsche Bank",
      "Commerzbank",
      "ING",
      "Santander",
      "BBVA",
      "Barclays",
      "Lloyds",
      "NatWest",
      "TD Bank",
      "RBC",
      "Scotiabank",
      "Commonwealth Bank",
      "Westpac",
      "ANZ",
      "NAB",
      "N26",
      "Revolut",
    ];

    const text = $section.text();
    for (const bank of knownBanks) {
      if (text.includes(bank)) {
        banks.push(bank);
      }
    }

    return banks.length > 0 ? JSON.stringify(banks) : null;
  }

  saveBankingInfo(db: ReturnType<typeof getDb>, item: BankingInfo): void {
    const stmt = db.prepare(`
      INSERT INTO banking_info (
        country_code, category, title, description, account_requirements,
        recommended_banks, tips, source_url, source_name, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.country_code,
      item.category,
      item.title,
      item.description,
      item.account_requirements,
      item.recommended_banks,
      item.tips,
      item.source_url,
      item.source_name,
      item.language
    );
  }
}

export async function scrapeBankingForCountry(
  countryCode: string
): Promise<BankingInfo[]> {
  const scraper = new BankingScraper();
  return scraper.scrapeCountry(countryCode);
}

export async function scrapeAllBankingInfo(): Promise<ScrapeResult[]> {
  const db = getDb();
  const countries = db
    .prepare("SELECT code FROM countries")
    .all() as { code: string }[];
  const scraper = new BankingScraper();

  const results: ScrapeResult[] = [];
  for (const country of countries) {
    try {
      const data = await scraper.scrapeCountry(country.code);
      results.push({ country: country.code, count: data.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Failed to scrape banking info for ${country.code}: ${message}`
      );
    }
  }

  return results;
}

import { Injectable } from "@nestjs/common";
import type { CheerioAPI, Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import {
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "../../scrapers/base-scraper.js";
import type { Source, SourceMap, BankingInfo, ScrapeResult } from "../../types/index.js";
import bankingSources from "../../sources/banking-sources.json" with { type: "json" };

const sources: SourceMap = bankingSources;

interface BankingRow {
  id: number;
  country_code: string;
  category: string;
  title: string;
  description: string | null;
  account_requirements: string | null;
  recommended_banks: string | null;
  tips: string | null;
  source_url: string | null;
  source_name: string | null;
  language: string;
}

@Injectable()
export class BankingService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(country?: string, category?: string, language?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM banking_info WHERE 1=1";
    const params: string[] = [];

    if (country) {
      query += " AND country_code = ?";
      params.push(country.toUpperCase());
    }
    if (category) {
      query += " AND category = ?";
      params.push(category.toLowerCase());
    }
    if (language) {
      query += " AND language = ?";
      params.push(language.toLowerCase());
    }

    query += " ORDER BY updated_at DESC";
    const results = db.prepare(query).all(...params) as BankingRow[];

    return results.map((r) => ({
      ...r,
      account_requirements: r.account_requirements ? JSON.parse(r.account_requirements) : null,
      recommended_banks: r.recommended_banks ? JSON.parse(r.recommended_banks) : null,
      tips: r.tips ? JSON.parse(r.tips) : null,
    }));
  }

  findCountries() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(b.id) as banking_entries
      FROM countries c
      LEFT JOIN banking_info b ON c.code = b.country_code
      GROUP BY c.code
      ORDER BY c.name
    `).all();
  }

  findCategories() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM banking_info
      GROUP BY category
      ORDER BY count DESC
    `).all();
  }

  findByCountry(countryCode: string, category?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM banking_info WHERE country_code = ?";
    const params: string[] = [countryCode.toUpperCase()];

    if (category) {
      query += " AND category = ?";
      params.push(category.toLowerCase());
    }

    query += " ORDER BY category, updated_at DESC";
    const results = db.prepare(query).all(...params) as BankingRow[];
    const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(countryCode.toUpperCase());

    return {
      country,
      data: results.map((r) => ({
        ...r,
        account_requirements: r.account_requirements ? JSON.parse(r.account_requirements) : null,
        recommended_banks: r.recommended_banks ? JSON.parse(r.recommended_banks) : null,
        tips: r.tips ? JSON.parse(r.tips) : null,
      })),
    };
  }

  async scrapeCountry(countryCode: string): Promise<BankingInfo[]> {
    const db = this.databaseService.getDb();
    const countrySources = sources[countryCode] || [];
    const results: BankingInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(`[BankingScraper] Scraping ${source.name} for ${countryCode}...`);
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        this.databaseService.logScrape(source.name, source.url, "success", data.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[BankingScraper] Failed: ${message}`);
        this.databaseService.logScrape(source.name, source.url, "error", 0, message);
      }
    }

    for (const item of results) {
      this.saveBankingInfo(db, item);
    }

    return results;
  }

  private async scrapeSource(source: Source, countryCode: string): Promise<BankingInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: BankingInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each((_, section) => {
      const $section = $(section);
      const title = extractText($section.find("h1, h2, h3, .title").first());

      if (title && this.isBankingRelated(title)) {
        const description = extractText($section.find("p").first());
        const tips = extractListItems($, "ul li, ol li");

        results.push({
          country_code: countryCode,
          category: this.inferCategory(title),
          title,
          description: cleanText(description),
          account_requirements: this.extractRequirements($section),
          recommended_banks: this.extractBanks($section),
          tips: tips.length > 0 ? JSON.stringify(tips) : null,
          source_url: url,
          source_name: source.name,
          language: "en",
        });
      }
    });

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription = extractText($('meta[name="description"]').attr("content") || "") || extractText($("p").first());

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

  private isBankingRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = ["bank", "account", "finance", "money", "transfer", "payment", "credit", "debit", "savings"];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
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

  private extractRequirements($section: Cheerio<any>): string | null {
    const requirements: string[] = [];
    const reqKeywords = ["passport", "id", "proof of address", "proof of income", "residence permit", "tax number", "social security"];
    const text = $section.text().toLowerCase();
    for (const req of reqKeywords) {
      if (text.includes(req)) requirements.push(req);
    }
    return requirements.length > 0 ? JSON.stringify(requirements) : null;
  }

  private extractBanks($section: Cheerio<any>): string | null {
    const banks: string[] = [];
    const knownBanks = [
      "BNP Paribas", "Societe Generale", "Credit Agricole", "HSBC", "Deutsche Bank",
      "Commerzbank", "ING", "Santander", "BBVA", "Barclays", "Lloyds", "NatWest",
      "TD Bank", "RBC", "Scotiabank", "Commonwealth Bank", "Westpac", "ANZ", "NAB",
      "N26", "Revolut",
    ];
    const text = $section.text();
    for (const bank of knownBanks) {
      if (text.includes(bank)) banks.push(bank);
    }
    return banks.length > 0 ? JSON.stringify(banks) : null;
  }

  private saveBankingInfo(db: ReturnType<DatabaseService["getDb"]>, item: BankingInfo): void {
    const stmt = db.prepare(`
      INSERT INTO banking_info (country_code, category, title, description, account_requirements, recommended_banks, tips, source_url, source_name, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(item.country_code, item.category, item.title, item.description, item.account_requirements, item.recommended_banks, item.tips, item.source_url, item.source_name, item.language);
  }
}

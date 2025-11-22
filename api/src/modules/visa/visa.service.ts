import { Injectable } from "@nestjs/common";
import type { CheerioAPI, Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import {
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "../../scrapers/base-scraper.js";
import type { Source, SourceMap, VisaInfo, ScrapeResult } from "../../types/index.js";
import visaSources from "../../sources/visa-sources.json" with { type: "json" };

const sources: SourceMap = visaSources;

interface VisaRow {
  id: number;
  country_code: string;
  visa_type: string;
  title: string;
  description: string | null;
  requirements: string | null;
  processing_time: string | null;
  cost: string | null;
  validity: string | null;
  source_url: string | null;
  source_name: string | null;
  language: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class VisaService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(country?: string, type?: string, language?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM visa_info WHERE 1=1";
    const params: string[] = [];

    if (country) {
      query += " AND country_code = ?";
      params.push(country.toUpperCase());
    }
    if (type) {
      query += " AND visa_type = ?";
      params.push(type.toLowerCase());
    }
    if (language) {
      query += " AND language = ?";
      params.push(language.toLowerCase());
    }

    query += " ORDER BY updated_at DESC";
    const results = db.prepare(query).all(...params) as VisaRow[];

    return results.map((r) => ({
      ...r,
      requirements: r.requirements ? JSON.parse(r.requirements) : null,
    }));
  }

  findCountries() {
    const db = this.databaseService.getDb();
    return db
      .prepare(
        `
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(v.id) as visa_entries
      FROM countries c
      LEFT JOIN visa_info v ON c.code = v.country_code
      GROUP BY c.code
      ORDER BY c.name
    `
      )
      .all();
  }

  findTypes() {
    const db = this.databaseService.getDb();
    return db
      .prepare(
        `
      SELECT DISTINCT visa_type, COUNT(*) as count
      FROM visa_info
      GROUP BY visa_type
      ORDER BY count DESC
    `
      )
      .all();
  }

  findByCountry(countryCode: string, type?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM visa_info WHERE country_code = ?";
    const params: string[] = [countryCode.toUpperCase()];

    if (type) {
      query += " AND visa_type = ?";
      params.push(type.toLowerCase());
    }

    query += " ORDER BY visa_type, updated_at DESC";
    const results = db.prepare(query).all(...params) as VisaRow[];

    const country = db
      .prepare("SELECT * FROM countries WHERE code = ?")
      .get(countryCode.toUpperCase());

    return {
      country,
      data: results.map((r) => ({
        ...r,
        requirements: r.requirements ? JSON.parse(r.requirements) : null,
      })),
    };
  }

  findByCountryAndType(countryCode: string, visaType: string) {
    const db = this.databaseService.getDb();
    const results = db
      .prepare(
        `
      SELECT * FROM visa_info
      WHERE country_code = ? AND visa_type = ?
      ORDER BY updated_at DESC
    `
      )
      .all(countryCode.toUpperCase(), visaType.toLowerCase()) as VisaRow[];

    return results.map((r) => ({
      ...r,
      requirements: r.requirements ? JSON.parse(r.requirements) : null,
    }));
  }

  async scrapeCountry(countryCode: string): Promise<VisaInfo[]> {
    const db = this.databaseService.getDb();
    const countrySources = this.getSourcesForCountry(countryCode);
    const results: VisaInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(`[VisaScraper] Scraping ${source.name} for ${countryCode}...`);
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        this.databaseService.logScrape(source.name, source.url, "success", data.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[VisaScraper] Failed to scrape ${source.name}: ${message}`);
        this.databaseService.logScrape(source.name, source.url, "error", 0, message);
      }
    }

    for (const item of results) {
      this.saveVisaInfo(db, item);
    }

    return results;
  }

  async scrapeAll(): Promise<ScrapeResult[]> {
    const db = this.databaseService.getDb();
    const countries = db.prepare("SELECT code FROM countries").all() as { code: string }[];
    const results: ScrapeResult[] = [];

    for (const country of countries) {
      try {
        const data = await this.scrapeCountry(country.code);
        results.push({ country: country.code, count: data.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed to scrape visa info for ${country.code}: ${message}`);
      }
    }

    return results;
  }

  private getSourcesForCountry(countryCode: string): Source[] {
    return sources[countryCode] || [];
  }

  private async scrapeSource(source: Source, countryCode: string): Promise<VisaInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: VisaInfo[] = [];

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
            requirements: requirements.length > 0 ? JSON.stringify(requirements) : null,
            processing_time: this.extractProcessingTime($section),
            cost: this.extractCost($section),
            validity: this.extractValidity($section),
            source_url: url,
            source_name: source.name,
            language: "en",
          });
        }
      }
    });

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

  private inferVisaType(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();

    if (lowerText.includes("tourist") || lowerText.includes("visitor")) return "tourist";
    if (lowerText.includes("work") || lowerText.includes("employment")) return "work";
    if (lowerText.includes("student") || lowerText.includes("study")) return "student";
    if (lowerText.includes("business")) return "business";
    if (lowerText.includes("transit")) return "transit";
    if (lowerText.includes("family") || lowerText.includes("spouse")) return "family";
    if (lowerText.includes("permanent") || lowerText.includes("residence")) return "residence";

    return "general";
  }

  private extractProcessingTime($section: Cheerio<any>): string | null {
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

  private extractCost($section: Cheerio<any>): string | null {
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

  private extractValidity($section: Cheerio<any>): string | null {
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

  private saveVisaInfo(db: ReturnType<DatabaseService["getDb"]>, item: VisaInfo): void {
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

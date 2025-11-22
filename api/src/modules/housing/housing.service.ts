import { Injectable } from "@nestjs/common";
import type { CheerioAPI, Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import {
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "../../scrapers/base-scraper.js";
import type { Source, SourceMap, HousingInfo, RentalPlatform, ScrapeResult } from "../../types/index.js";
import housingSources from "../../sources/housing-sources.json" with { type: "json" };

const sources: SourceMap = housingSources;

interface HousingRow {
  id: number;
  country_code: string;
  city: string | null;
  category: string;
  title: string;
  description: string | null;
  average_rent: string | null;
  required_documents: string | null;
  tips: string | null;
  rental_platforms: string | null;
  source_url: string | null;
  source_name: string | null;
  language: string;
}

@Injectable()
export class HousingService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(country?: string, city?: string, category?: string, language?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM housing_info WHERE 1=1";
    const params: string[] = [];

    if (country) {
      query += " AND country_code = ?";
      params.push(country.toUpperCase());
    }
    if (city) {
      query += " AND city LIKE ?";
      params.push(`%${city}%`);
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
    const results = db.prepare(query).all(...params) as HousingRow[];

    return results.map((r) => ({
      ...r,
      required_documents: r.required_documents ? JSON.parse(r.required_documents) : null,
      tips: r.tips ? JSON.parse(r.tips) : null,
      rental_platforms: r.rental_platforms ? JSON.parse(r.rental_platforms) : null,
    }));
  }

  findCountries() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(h.id) as housing_entries
      FROM countries c
      LEFT JOIN housing_info h ON c.code = h.country_code
      GROUP BY c.code
      ORDER BY c.name
    `).all();
  }

  findCities(country?: string) {
    const db = this.databaseService.getDb();
    let query = `
      SELECT DISTINCT city, country_code, COUNT(*) as entries
      FROM housing_info
      WHERE city IS NOT NULL
    `;
    const params: string[] = [];

    if (country) {
      query += " AND country_code = ?";
      params.push(country.toUpperCase());
    }

    query += " GROUP BY city, country_code ORDER BY entries DESC";
    return db.prepare(query).all(...params);
  }

  findCategories() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM housing_info
      GROUP BY category
      ORDER BY count DESC
    `).all();
  }

  findByCountry(countryCode: string, city?: string, category?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM housing_info WHERE country_code = ?";
    const params: string[] = [countryCode.toUpperCase()];

    if (city) {
      query += " AND city LIKE ?";
      params.push(`%${city}%`);
    }
    if (category) {
      query += " AND category = ?";
      params.push(category.toLowerCase());
    }

    query += " ORDER BY city, category, updated_at DESC";
    const results = db.prepare(query).all(...params) as HousingRow[];
    const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(countryCode.toUpperCase());

    return {
      country,
      data: results.map((r) => ({
        ...r,
        required_documents: r.required_documents ? JSON.parse(r.required_documents) : null,
        tips: r.tips ? JSON.parse(r.tips) : null,
        rental_platforms: r.rental_platforms ? JSON.parse(r.rental_platforms) : null,
      })),
    };
  }

  findByCountryAndCity(countryCode: string, city: string) {
    const db = this.databaseService.getDb();
    const results = db.prepare(`
      SELECT * FROM housing_info
      WHERE country_code = ? AND city LIKE ?
      ORDER BY category, updated_at DESC
    `).all(countryCode.toUpperCase(), `%${city}%`) as HousingRow[];

    return results.map((r) => ({
      ...r,
      required_documents: r.required_documents ? JSON.parse(r.required_documents) : null,
      tips: r.tips ? JSON.parse(r.tips) : null,
      rental_platforms: r.rental_platforms ? JSON.parse(r.rental_platforms) : null,
    }));
  }

  async scrapeCountry(countryCode: string): Promise<HousingInfo[]> {
    const db = this.databaseService.getDb();
    const countrySources = sources[countryCode] || [];
    const results: HousingInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(`[HousingScraper] Scraping ${source.name} for ${countryCode}...`);
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        this.databaseService.logScrape(source.name, source.url, "success", data.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[HousingScraper] Failed: ${message}`);
        this.databaseService.logScrape(source.name, source.url, "error", 0, message);
      }
    }

    for (const item of results) {
      this.saveHousingInfo(db, item);
    }

    return results;
  }

  private async scrapeSource(source: Source, countryCode: string): Promise<HousingInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: HousingInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each((_, section) => {
      const $section = $(section);
      const title = extractText($section.find("h1, h2, h3, .title").first());

      if (title && this.isHousingRelated(title)) {
        const description = extractText($section.find("p").first());
        const tips = extractListItems($, "ul li, ol li");

        results.push({
          country_code: countryCode,
          city: this.extractCity($section.text()),
          category: this.inferCategory(title),
          title,
          description: cleanText(description),
          average_rent: this.extractRent($section.text()),
          required_documents: this.extractDocuments($section),
          tips: tips.length > 0 ? JSON.stringify(tips) : null,
          rental_platforms: this.extractPlatforms($section, $),
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
        city: null,
        category: "general",
        title: pageTitle || `Housing Information for ${countryCode}`,
        description: cleanText(pageDescription),
        average_rent: null,
        required_documents: null,
        tips: null,
        rental_platforms: null,
        source_url: url,
        source_name: source.name,
        language: "en",
      });
    }

    return results;
  }

  private isHousingRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = ["housing", "rent", "apartment", "flat", "accommodation", "lease", "tenant", "landlord", "property", "home", "living"];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("rent")) return "rental";
    if (lowerText.includes("buy") || lowerText.includes("purchase")) return "buying";
    if (lowerText.includes("student")) return "student";
    if (lowerText.includes("temporary") || lowerText.includes("short")) return "temporary";
    if (lowerText.includes("social")) return "social_housing";
    if (lowerText.includes("right") || lowerText.includes("law")) return "rights";
    return "general";
  }

  private extractCity(text: string | null): string | null {
    if (!text) return null;
    const majorCities = [
      "Paris", "Lyon", "Marseille", "Berlin", "Munich", "Frankfurt", "Hamburg",
      "Madrid", "Barcelona", "Amsterdam", "Rotterdam", "London", "Manchester",
      "Toronto", "Vancouver", "Montreal", "Sydney", "Melbourne", "New York",
      "Los Angeles", "Tokyo", "Singapore", "Dubai",
    ];
    for (const city of majorCities) {
      if (text.includes(city)) return city;
    }
    return null;
  }

  private extractRent(text: string | null): string | null {
    if (!text) return null;
    const patterns = [
      /average\s+rent[:\s]+[€$£]?\s*[\d,]+/i,
      /[€$£]\s*[\d,]+\s*(?:per\s+)?(?:month|week)/i,
      /rent[:\s]+[€$£]?\s*[\d,]+\s*[-–]\s*[€$£]?\s*[\d,]+/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  private extractDocuments($section: Cheerio<any>): string | null {
    const documents: string[] = [];
    const documentKeywords = ["passport", "id", "proof of income", "bank statement", "employment contract", "references", "deposit", "guarantor", "visa"];
    const text = $section.text().toLowerCase();
    for (const doc of documentKeywords) {
      if (text.includes(doc)) documents.push(doc);
    }
    return documents.length > 0 ? JSON.stringify(documents) : null;
  }

  private extractPlatforms($section: Cheerio<any>, $: CheerioAPI): string | null {
    const platforms: RentalPlatform[] = [];
    $section.find("a").each((_: number, el: any) => {
      const href = $(el).attr("href");
      const text = extractText($(el));
      if (href && this.isHousingRelated(text || href)) {
        platforms.push({ name: text, url: href });
      }
    });
    return platforms.length > 0 ? JSON.stringify(platforms) : null;
  }

  private saveHousingInfo(db: ReturnType<DatabaseService["getDb"]>, item: HousingInfo): void {
    const stmt = db.prepare(`
      INSERT INTO housing_info (country_code, city, category, title, description, average_rent, required_documents, tips, rental_platforms, source_url, source_name, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(item.country_code, item.city, item.category, item.title, item.description, item.average_rent, item.required_documents, item.tips, item.rental_platforms, item.source_url, item.source_name, item.language);
  }
}

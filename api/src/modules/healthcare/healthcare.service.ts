import { Injectable } from "@nestjs/common";
import type { CheerioAPI, Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import {
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "../../scrapers/base-scraper.js";
import type { Source, SourceMap, HealthcareInfo, UsefulLink, EmergencyNumbers, ScrapeResult } from "../../types/index.js";
import healthcareSources from "../../sources/healthcare-sources.json" with { type: "json" };

const sources: SourceMap = healthcareSources;

interface HealthcareRow {
  id: number;
  country_code: string;
  category: string;
  title: string;
  description: string | null;
  public_system_info: string | null;
  insurance_requirements: string | null;
  emergency_numbers: string | null;
  useful_links: string | null;
  source_url: string | null;
  source_name: string | null;
  language: string;
}

@Injectable()
export class HealthcareService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(country?: string, category?: string, language?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM healthcare_info WHERE 1=1";
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
    const results = db.prepare(query).all(...params) as HealthcareRow[];

    return results.map((r) => ({
      ...r,
      insurance_requirements: r.insurance_requirements ? JSON.parse(r.insurance_requirements) : null,
      emergency_numbers: r.emergency_numbers ? JSON.parse(r.emergency_numbers) : null,
      useful_links: r.useful_links ? JSON.parse(r.useful_links) : null,
    }));
  }

  findCountries() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(h.id) as healthcare_entries
      FROM countries c
      LEFT JOIN healthcare_info h ON c.code = h.country_code
      GROUP BY c.code
      ORDER BY c.name
    `).all();
  }

  findEmergencyNumbers(countryCode: string) {
    const db = this.databaseService.getDb();
    const result = db.prepare(`
      SELECT emergency_numbers
      FROM healthcare_info
      WHERE country_code = ? AND emergency_numbers IS NOT NULL
      LIMIT 1
    `).get(countryCode.toUpperCase()) as { emergency_numbers: string } | undefined;

    if (!result) return null;
    return JSON.parse(result.emergency_numbers);
  }

  findByCountry(countryCode: string, category?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM healthcare_info WHERE country_code = ?";
    const params: string[] = [countryCode.toUpperCase()];

    if (category) {
      query += " AND category = ?";
      params.push(category.toLowerCase());
    }

    query += " ORDER BY category, updated_at DESC";
    const results = db.prepare(query).all(...params) as HealthcareRow[];
    const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(countryCode.toUpperCase());

    return {
      country,
      data: results.map((r) => ({
        ...r,
        insurance_requirements: r.insurance_requirements ? JSON.parse(r.insurance_requirements) : null,
        emergency_numbers: r.emergency_numbers ? JSON.parse(r.emergency_numbers) : null,
        useful_links: r.useful_links ? JSON.parse(r.useful_links) : null,
      })),
    };
  }

  async scrapeCountry(countryCode: string): Promise<HealthcareInfo[]> {
    const db = this.databaseService.getDb();
    const countrySources = sources[countryCode] || [];
    const results: HealthcareInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(`[HealthcareScraper] Scraping ${source.name} for ${countryCode}...`);
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        this.databaseService.logScrape(source.name, source.url, "success", data.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[HealthcareScraper] Failed: ${message}`);
        this.databaseService.logScrape(source.name, source.url, "error", 0, message);
      }
    }

    for (const item of results) {
      this.saveHealthcareInfo(db, item);
    }

    return results;
  }

  private async scrapeSource(source: Source, countryCode: string): Promise<HealthcareInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: HealthcareInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each((_, section) => {
      const $section = $(section);
      const title = extractText($section.find("h1, h2, h3, .title").first());

      if (title && this.isHealthcareRelated(title)) {
        const description = extractText($section.find("p").first());
        extractListItems($, "ul li, ol li");

        results.push({
          country_code: countryCode,
          category: this.inferCategory(title),
          title,
          description: cleanText(description),
          public_system_info: this.extractPublicInfo($section.text()),
          insurance_requirements: this.extractInsuranceInfo($section),
          emergency_numbers: this.extractEmergencyNumbers($section.text()),
          useful_links: this.extractLinks($section, $),
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
        title: pageTitle || `Healthcare Information for ${countryCode}`,
        description: cleanText(pageDescription),
        public_system_info: null,
        insurance_requirements: null,
        emergency_numbers: this.getDefaultEmergencyNumbers(countryCode),
        useful_links: null,
        source_url: url,
        source_name: source.name,
        language: "en",
      });
    }

    return results;
  }

  private isHealthcareRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = ["health", "medical", "insurance", "hospital", "doctor", "care", "emergency", "medicine", "patient"];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("insurance")) return "insurance";
    if (lowerText.includes("emergency")) return "emergency";
    if (lowerText.includes("hospital")) return "hospitals";
    if (lowerText.includes("doctor") || lowerText.includes("gp")) return "doctors";
    if (lowerText.includes("pharmacy") || lowerText.includes("medicine")) return "pharmacy";
    if (lowerText.includes("dental")) return "dental";
    return "general";
  }

  private extractPublicInfo(text: string | null): string | null {
    if (!text) return null;
    const patterns = [
      /public\s+health\s+(?:system|care|insurance)[^.]+\./i,
      /national\s+health[^.]+\./i,
      /universal\s+(?:health)?care[^.]+\./i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  private extractInsuranceInfo($section: Cheerio<any>): string | null {
    const requirements: string[] = [];
    const insuranceKeywords = ["insurance required", "mandatory insurance", "health coverage", "ehic", "social security"];
    const text = $section.text().toLowerCase();
    for (const req of insuranceKeywords) {
      if (text.includes(req)) requirements.push(req);
    }
    return requirements.length > 0 ? JSON.stringify(requirements) : null;
  }

  private extractEmergencyNumbers(text: string | null): string | null {
    if (!text) return null;
    const numbers: string[] = [];
    const patterns = [
      /emergency[:\s]+(\d{2,3})/i,
      /ambulance[:\s]+(\d{2,3})/i,
      /(\d{3})\s*(?:emergency|ambulance)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) numbers.push(match[0]);
    }
    return numbers.length > 0 ? JSON.stringify(numbers) : null;
  }

  private getDefaultEmergencyNumbers(countryCode: string): string | null {
    const emergencyNumbers: Record<string, EmergencyNumbers> = {
      FR: { emergency: "112", samu: "15", police: "17", fire: "18" },
      DE: { emergency: "112", police: "110" },
      ES: { emergency: "112" },
      IT: { emergency: "112", carabinieri: "112" },
      GB: { emergency: "999", nhs: "111" },
      US: { emergency: "911" },
      CA: { emergency: "911" },
      AU: { emergency: "000" },
    };
    return emergencyNumbers[countryCode] ? JSON.stringify(emergencyNumbers[countryCode]) : null;
  }

  private extractLinks($section: Cheerio<any>, $: CheerioAPI): string | null {
    const links: UsefulLink[] = [];
    $section.find("a").each((_: number, el: any) => {
      const href = $(el).attr("href");
      const text = extractText($(el));
      if (href && this.isHealthcareRelated(text || href)) {
        links.push({ name: text, url: href });
      }
    });
    return links.length > 0 ? JSON.stringify(links) : null;
  }

  private saveHealthcareInfo(db: ReturnType<DatabaseService["getDb"]>, item: HealthcareInfo): void {
    const stmt = db.prepare(`
      INSERT INTO healthcare_info (country_code, category, title, description, public_system_info, insurance_requirements, emergency_numbers, useful_links, source_url, source_name, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(item.country_code, item.category, item.title, item.description, item.public_system_info, item.insurance_requirements, item.emergency_numbers, item.useful_links, item.source_url, item.source_name, item.language);
  }
}

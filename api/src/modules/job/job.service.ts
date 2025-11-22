import { Injectable } from "@nestjs/common";
import type { Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import {
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "../../scrapers/base-scraper.js";
import type { Source, SourceMap, JobInfo, JobPortal, ScrapeResult } from "../../types/index.js";
import jobSources from "../../sources/job-sources.json" with { type: "json" };

const sources: SourceMap = jobSources;

interface JobRow {
  id: number;
  country_code: string;
  category: string;
  title: string;
  description: string | null;
  work_permit_required: boolean | null;
  average_salary: string | null;
  job_search_tips: string | null;
  popular_sectors: string | null;
  job_portals: string | null;
  source_url: string | null;
  source_name: string | null;
  language: string;
}

@Injectable()
export class JobService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(country?: string, category?: string, language?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM job_info WHERE 1=1";
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
    const results = db.prepare(query).all(...params) as JobRow[];

    return results.map((r) => ({
      ...r,
      job_search_tips: r.job_search_tips ? JSON.parse(r.job_search_tips) : null,
      popular_sectors: r.popular_sectors ? JSON.parse(r.popular_sectors) : null,
      job_portals: r.job_portals ? JSON.parse(r.job_portals) : null,
    }));
  }

  findCountries() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(j.id) as job_entries
      FROM countries c
      LEFT JOIN job_info j ON c.code = j.country_code
      GROUP BY c.code
      ORDER BY c.name
    `).all();
  }

  findCategories() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM job_info
      GROUP BY category
      ORDER BY count DESC
    `).all();
  }

  findSectors() {
    const db = this.databaseService.getDb();
    const results = db.prepare(`
      SELECT country_code, popular_sectors
      FROM job_info
      WHERE popular_sectors IS NOT NULL
    `).all() as { country_code: string; popular_sectors: string }[];

    const sectorCounts: Record<string, number> = {};
    for (const row of results) {
      const sectors = JSON.parse(row.popular_sectors) as string[];
      for (const sector of sectors) {
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      }
    }

    return Object.entries(sectorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  findByCountry(countryCode: string, category?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM job_info WHERE country_code = ?";
    const params: string[] = [countryCode.toUpperCase()];

    if (category) {
      query += " AND category = ?";
      params.push(category.toLowerCase());
    }

    query += " ORDER BY category, updated_at DESC";
    const results = db.prepare(query).all(...params) as JobRow[];
    const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(countryCode.toUpperCase());

    return {
      country,
      data: results.map((r) => ({
        ...r,
        job_search_tips: r.job_search_tips ? JSON.parse(r.job_search_tips) : null,
        popular_sectors: r.popular_sectors ? JSON.parse(r.popular_sectors) : null,
        job_portals: r.job_portals ? JSON.parse(r.job_portals) : null,
      })),
    };
  }

  async scrapeCountry(countryCode: string): Promise<JobInfo[]> {
    const db = this.databaseService.getDb();
    const countrySources = sources[countryCode] || [];
    const results: JobInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(`[JobScraper] Scraping ${source.name} for ${countryCode}...`);
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        this.databaseService.logScrape(source.name, source.url, "success", data.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[JobScraper] Failed: ${message}`);
        this.databaseService.logScrape(source.name, source.url, "error", 0, message);
      }
    }

    for (const item of results) {
      this.saveJobInfo(db, item);
    }

    return results;
  }

  private async scrapeSource(source: Source, countryCode: string): Promise<JobInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: JobInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each((_, section) => {
      const $section = $(section);
      const title = extractText($section.find("h1, h2, h3, .title").first());

      if (title && this.isJobRelated(title)) {
        const description = extractText($section.find("p").first());
        const tips = extractListItems($, "ul li, ol li");

        results.push({
          country_code: countryCode,
          category: this.inferCategory(title),
          title,
          description: cleanText(description),
          work_permit_required: this.checkWorkPermitRequired($section.text()),
          average_salary: this.extractSalary($section.text()),
          job_search_tips: tips.length > 0 ? JSON.stringify(tips) : null,
          popular_sectors: this.extractSectors($section),
          job_portals: this.extractJobPortals($section, $),
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
        title: pageTitle || `Job Market Information for ${countryCode}`,
        description: cleanText(pageDescription),
        work_permit_required: null,
        average_salary: null,
        job_search_tips: null,
        popular_sectors: null,
        job_portals: null,
        source_url: url,
        source_name: source.name,
        language: "en",
      });
    }

    return results;
  }

  private isJobRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = ["job", "work", "employment", "career", "salary", "hiring", "recruit", "labour", "labor", "profession"];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("permit") || lowerText.includes("authorization")) return "work_permit";
    if (lowerText.includes("salary") || lowerText.includes("wage")) return "salary";
    if (lowerText.includes("search") || lowerText.includes("find")) return "job_search";
    if (lowerText.includes("sector") || lowerText.includes("industry")) return "sectors";
    if (lowerText.includes("right") || lowerText.includes("law")) return "rights";
    if (lowerText.includes("contract")) return "contracts";
    return "general";
  }

  private checkWorkPermitRequired(text: string | null): boolean | null {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    if (lowerText.includes("work permit required") || lowerText.includes("need a work permit")) return true;
    if (lowerText.includes("no work permit") || lowerText.includes("without permit")) return false;
    return null;
  }

  private extractSalary(text: string | null): string | null {
    if (!text) return null;
    const patterns = [/average\s+salary[:\s]+[€$£]?\s*[\d,]+/i, /minimum\s+wage[:\s]+[€$£]?\s*[\d,]+/i, /[€$£]\s*[\d,]+\s*(?:per\s+)?(?:month|year|hour)/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  private extractSectors($section: Cheerio<any>): string | null {
    const sectors: string[] = [];
    const sectorKeywords = ["technology", "healthcare", "finance", "engineering", "tourism", "education", "manufacturing", "agriculture", "retail", "construction"];
    const text = $section.text().toLowerCase();
    for (const sector of sectorKeywords) {
      if (text.includes(sector)) sectors.push(sector);
    }
    return sectors.length > 0 ? JSON.stringify(sectors) : null;
  }

  private extractJobPortals($section: Cheerio<any>, $: any): string | null {
    const portals: JobPortal[] = [];
    $section.find("a").each((_: number, el: any) => {
      const href = $(el).attr("href");
      const text = extractText($(el));
      if (href && (text?.toLowerCase().includes("job") || href.includes("job"))) {
        portals.push({ name: text, url: href });
      }
    });
    return portals.length > 0 ? JSON.stringify(portals) : null;
  }

  private saveJobInfo(db: ReturnType<DatabaseService["getDb"]>, item: JobInfo): void {
    const stmt = db.prepare(`
      INSERT INTO job_info (country_code, category, title, description, work_permit_required, average_salary, job_search_tips, popular_sectors, job_portals, source_url, source_name, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(item.country_code, item.category, item.title, item.description, item.work_permit_required, item.average_salary, item.job_search_tips, item.popular_sectors, item.job_portals, item.source_url, item.source_name, item.language);
  }
}

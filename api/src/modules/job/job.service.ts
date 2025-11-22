import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Not } from "typeorm";
import type { Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import { JobInfo } from "../../entities/job-info.entity.js";
import { Country } from "../../entities/country.entity.js";
import {
  fetchPage,
  extractText,
  cleanText,
  extractListItems,
} from "../../scrapers/base-scraper.js";
import type {
  Source,
  SourceMap,
  JobPortal,
  ScrapeResult,
} from "../../types/index.js";
import jobSources from "../../sources/job-sources.json" with { type: "json" };

const sources: SourceMap = jobSources;

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(JobInfo)
    private jobInfoRepository: Repository<JobInfo>,
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    private readonly databaseService: DatabaseService,
  ) {}

  async findAll(country?: string, category?: string, language?: string) {
    const queryBuilder = this.jobInfoRepository.createQueryBuilder("job");

    if (country) {
      queryBuilder.andWhere("job.country_code = :country", {
        country: country.toUpperCase(),
      });
    }
    if (category) {
      queryBuilder.andWhere("job.category = :category", {
        category: category.toLowerCase(),
      });
    }
    if (language) {
      queryBuilder.andWhere("job.language = :language", {
        language: language.toLowerCase(),
      });
    }

    queryBuilder.orderBy("job.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    return results.map((r) => ({
      ...r,
      job_search_tips: r.job_search_tips ? JSON.parse(r.job_search_tips) : null,
      popular_sectors: r.popular_sectors ? JSON.parse(r.popular_sectors) : null,
      job_portals: r.job_portals ? JSON.parse(r.job_portals) : null,
    }));
  }

  async findCountries() {
    const results = await this.countryRepository
      .createQueryBuilder("country")
      .leftJoin("country.jobs", "job")
      .select([
        "country.code",
        "country.name",
        "country.name_fr",
        "country.region",
      ])
      .addSelect("COUNT(job.id)", "job_entries")
      .groupBy("country.code")
      .addGroupBy("country.name")
      .addGroupBy("country.name_fr")
      .addGroupBy("country.region")
      .orderBy("country.name", "ASC")
      .getRawMany();

    return results;
  }

  async findCategories() {
    const results = await this.jobInfoRepository
      .createQueryBuilder("job")
      .select("job.category", "category")
      .addSelect("COUNT(*)", "count")
      .groupBy("job.category")
      .orderBy("count", "DESC")
      .getRawMany();

    return results;
  }

  async findSectors() {
    const results = await this.jobInfoRepository.find({
      select: ["country_code", "popular_sectors"],
      where: { popular_sectors: Not(IsNull()) },
    });

    const sectorCounts: Record<string, number> = {};
    for (const row of results) {
      if (row.popular_sectors) {
        const sectors = JSON.parse(row.popular_sectors) as string[];
        for (const sector of sectors) {
          sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        }
      }
    }

    return Object.entries(sectorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  async findByCountry(countryCode: string, category?: string) {
    const queryBuilder = this.jobInfoRepository
      .createQueryBuilder("job")
      .where("job.country_code = :countryCode", {
        countryCode: countryCode.toUpperCase(),
      });

    if (category) {
      queryBuilder.andWhere("job.category = :category", {
        category: category.toLowerCase(),
      });
    }

    queryBuilder.orderBy("job.category").addOrderBy("job.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode.toUpperCase() },
    });

    return {
      country,
      data: results.map((r) => ({
        ...r,
        job_search_tips: r.job_search_tips
          ? JSON.parse(r.job_search_tips)
          : null,
        popular_sectors: r.popular_sectors
          ? JSON.parse(r.popular_sectors)
          : null,
        job_portals: r.job_portals ? JSON.parse(r.job_portals) : null,
      })),
    };
  }

  async scrapeCountry(countryCode: string): Promise<JobInfo[]> {
    const countrySources = sources[countryCode] || [];
    const results: JobInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(
          `[JobScraper] Scraping ${source.name} for ${countryCode}...`,
        );
        const data = await this.scrapeSource(source, countryCode);
        results.push(...data);
        await this.databaseService.logScrape(
          source.name,
          source.url,
          "success",
          data.length,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[JobScraper] Failed: ${message}`);
        await this.databaseService.logScrape(
          source.name,
          source.url,
          "error",
          0,
          message,
        );
      }
    }

    for (const item of results) {
      await this.saveJobInfo(item);
    }

    return results;
  }

  async scrapeAll(): Promise<ScrapeResult[]> {
    const countries = await this.countryRepository.find({
      select: ["code"],
    });
    const results: ScrapeResult[] = [];

    for (const country of countries) {
      try {
        const data = await this.scrapeCountry(country.code);
        results.push({ country: country.code, count: data.length });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `Failed to scrape job info for ${country.code}: ${message}`,
        );
      }
    }

    return results;
  }

  private async scrapeSource(
    source: Source,
    countryCode: string,
  ): Promise<JobInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: JobInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each(
      (_, section) => {
        const $section = $(section);
        const title = extractText($section.find("h1, h2, h3, .title").first());

        if (title && this.isJobRelated(title)) {
          const description = extractText($section.find("p").first());
          const tips = extractListItems($, "ul li, ol li");

          const jobInfo = new JobInfo();
          jobInfo.country_code = countryCode;
          jobInfo.category = this.inferCategory(title);
          jobInfo.title = title;
          jobInfo.description = cleanText(description);
          jobInfo.work_permit_required = this.checkWorkPermitRequired(
            $section.text(),
          );
          jobInfo.average_salary = this.extractSalary($section.text());
          jobInfo.job_search_tips =
            tips.length > 0 ? JSON.stringify(tips) : null;
          jobInfo.popular_sectors = this.extractSectors($section);
          jobInfo.job_portals = this.extractJobPortals($section, $);
          jobInfo.source_url = url;
          jobInfo.source_name = source.name;
          jobInfo.language = "en";

          results.push(jobInfo);
        }
      },
    );

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      const jobInfo = new JobInfo();
      jobInfo.country_code = countryCode;
      jobInfo.category = "general";
      jobInfo.title = pageTitle || `Job Market Information for ${countryCode}`;
      jobInfo.description = cleanText(pageDescription);
      jobInfo.work_permit_required = null;
      jobInfo.average_salary = null;
      jobInfo.job_search_tips = null;
      jobInfo.popular_sectors = null;
      jobInfo.job_portals = null;
      jobInfo.source_url = url;
      jobInfo.source_name = source.name;
      jobInfo.language = "en";

      results.push(jobInfo);
    }

    return results;
  }

  private isJobRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = [
      "job",
      "work",
      "employment",
      "career",
      "salary",
      "hiring",
      "recruit",
      "labour",
      "labor",
      "profession",
    ];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("permit") || lowerText.includes("authorization"))
      return "work_permit";
    if (lowerText.includes("salary") || lowerText.includes("wage"))
      return "salary";
    if (lowerText.includes("search") || lowerText.includes("find"))
      return "job_search";
    if (lowerText.includes("sector") || lowerText.includes("industry"))
      return "sectors";
    if (lowerText.includes("right") || lowerText.includes("law"))
      return "rights";
    if (lowerText.includes("contract")) return "contracts";
    return "general";
  }

  private checkWorkPermitRequired(text: string | null): boolean | null {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes("work permit required") ||
      lowerText.includes("need a work permit")
    )
      return true;
    if (
      lowerText.includes("no work permit") ||
      lowerText.includes("without permit")
    )
      return false;
    return null;
  }

  private extractSalary(text: string | null): string | null {
    if (!text) return null;
    const patterns = [
      /average\s+salary[:\s]+[€$£]?\s*[\d,]+/i,
      /minimum\s+wage[:\s]+[€$£]?\s*[\d,]+/i,
      /[€$£]\s*[\d,]+\s*(?:per\s+)?(?:month|year|hour)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  private extractSectors($section: Cheerio<any>): string | null {
    const sectors: string[] = [];
    const sectorKeywords = [
      "technology",
      "healthcare",
      "finance",
      "engineering",
      "tourism",
      "education",
      "manufacturing",
      "agriculture",
      "retail",
      "construction",
    ];
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
      if (
        href &&
        (text?.toLowerCase().includes("job") || href.includes("job"))
      ) {
        portals.push({ name: text, url: href });
      }
    });
    return portals.length > 0 ? JSON.stringify(portals) : null;
  }

  private async saveJobInfo(item: JobInfo): Promise<void> {
    await this.jobInfoRepository.save(item);
  }
}

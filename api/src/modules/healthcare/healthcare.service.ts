import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull } from "typeorm";
import type { CheerioAPI, Cheerio } from "cheerio";
import { DatabaseService } from "../database/database.service.js";
import { HealthcareInfo } from "../../entities/healthcare-info.entity.js";
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
  UsefulLink,
  EmergencyNumbers,
  ScrapeResult,
} from "../../types/index.js";
import healthcareSources from "../../sources/healthcare-sources.json" with { type: "json" };

const sources: SourceMap = healthcareSources;

@Injectable()
export class HealthcareService {
  constructor(
    @InjectRepository(HealthcareInfo)
    private healthcareInfoRepository: Repository<HealthcareInfo>,
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    private readonly databaseService: DatabaseService,
  ) {}

  async findAll(country?: string, category?: string, language?: string) {
    const queryBuilder =
      this.healthcareInfoRepository.createQueryBuilder("healthcare");

    if (country) {
      queryBuilder.andWhere("healthcare.country_code = :country", {
        country: country.toUpperCase(),
      });
    }
    if (category) {
      queryBuilder.andWhere("healthcare.category = :category", {
        category: category.toLowerCase(),
      });
    }
    if (language) {
      queryBuilder.andWhere("healthcare.language = :language", {
        language: language.toLowerCase(),
      });
    }

    queryBuilder.orderBy("healthcare.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    return results.map((r) => ({
      ...r,
      insurance_requirements: r.insurance_requirements
        ? JSON.parse(r.insurance_requirements)
        : null,
      emergency_numbers: r.emergency_numbers
        ? JSON.parse(r.emergency_numbers)
        : null,
      useful_links: r.useful_links ? JSON.parse(r.useful_links) : null,
    }));
  }

  async findCountries() {
    const results = await this.countryRepository
      .createQueryBuilder("country")
      .leftJoin("country.healthcare", "healthcare")
      .select([
        "country.code",
        "country.name",
        "country.name_fr",
        "country.region",
      ])
      .addSelect("COUNT(healthcare.id)", "healthcare_entries")
      .groupBy("country.code")
      .addGroupBy("country.name")
      .addGroupBy("country.name_fr")
      .addGroupBy("country.region")
      .orderBy("country.name", "ASC")
      .getRawMany();

    return results;
  }

  async findCategories() {
    const results = await this.healthcareInfoRepository
      .createQueryBuilder("healthcare")
      .select("healthcare.category", "category")
      .addSelect("COUNT(*)", "count")
      .groupBy("healthcare.category")
      .orderBy("count", "DESC")
      .getRawMany();

    return results;
  }

  async findEmergencyNumbers(countryCode: string) {
    const result = await this.healthcareInfoRepository.findOne({
      where: {
        country_code: countryCode.toUpperCase(),
        emergency_numbers: Not(IsNull()),
      },
      select: ["emergency_numbers"],
    });

    if (!result || !result.emergency_numbers) return null;
    return JSON.parse(result.emergency_numbers);
  }

  async findByCountry(countryCode: string, category?: string) {
    const queryBuilder = this.healthcareInfoRepository
      .createQueryBuilder("healthcare")
      .where("healthcare.country_code = :countryCode", {
        countryCode: countryCode.toUpperCase(),
      });

    if (category) {
      queryBuilder.andWhere("healthcare.category = :category", {
        category: category.toLowerCase(),
      });
    }

    queryBuilder
      .orderBy("healthcare.category")
      .addOrderBy("healthcare.updated_at", "DESC");

    const results = await queryBuilder.getMany();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode.toUpperCase() },
    });

    return {
      country,
      data: results.map((r) => ({
        ...r,
        insurance_requirements: r.insurance_requirements
          ? JSON.parse(r.insurance_requirements)
          : null,
        emergency_numbers: r.emergency_numbers
          ? JSON.parse(r.emergency_numbers)
          : null,
        useful_links: r.useful_links ? JSON.parse(r.useful_links) : null,
      })),
    };
  }

  async scrapeCountry(countryCode: string): Promise<HealthcareInfo[]> {
    const countrySources = sources[countryCode] || [];
    const results: HealthcareInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(
          `[HealthcareScraper] Scraping ${source.name} for ${countryCode}...`,
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
        console.error(`[HealthcareScraper] Failed: ${message}`);
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
      await this.saveHealthcareInfo(item);
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
          `Failed to scrape healthcare info for ${country.code}: ${message}`,
        );
      }
    }

    return results;
  }

  private async scrapeSource(
    source: Source,
    countryCode: string,
  ): Promise<HealthcareInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: HealthcareInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each(
      (_, section) => {
        const $section = $(section);
        const title = extractText($section.find("h1, h2, h3, .title").first());

        if (title && this.isHealthcareRelated(title)) {
          const description = extractText($section.find("p").first());
          extractListItems($, "ul li, ol li");

          const healthcareInfo = new HealthcareInfo();
          healthcareInfo.country_code = countryCode;
          healthcareInfo.category = this.inferCategory(title);
          healthcareInfo.title = title;
          healthcareInfo.description = cleanText(description);
          healthcareInfo.public_system_info = this.extractPublicInfo(
            $section.text(),
          );
          healthcareInfo.insurance_requirements =
            this.extractInsuranceInfo($section);
          healthcareInfo.emergency_numbers = this.extractEmergencyNumbers(
            $section.text(),
          );
          healthcareInfo.useful_links = this.extractLinks($section, $);
          healthcareInfo.source_url = url;
          healthcareInfo.source_name = source.name;
          healthcareInfo.language = "en";

          results.push(healthcareInfo);
        }
      },
    );

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      const healthcareInfo = new HealthcareInfo();
      healthcareInfo.country_code = countryCode;
      healthcareInfo.category = "general";
      healthcareInfo.title =
        pageTitle || `Healthcare Information for ${countryCode}`;
      healthcareInfo.description = cleanText(pageDescription);
      healthcareInfo.public_system_info = null;
      healthcareInfo.insurance_requirements = null;
      healthcareInfo.emergency_numbers =
        this.getDefaultEmergencyNumbers(countryCode);
      healthcareInfo.useful_links = null;
      healthcareInfo.source_url = url;
      healthcareInfo.source_name = source.name;
      healthcareInfo.language = "en";

      results.push(healthcareInfo);
    }

    return results;
  }

  private isHealthcareRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = [
      "health",
      "medical",
      "insurance",
      "hospital",
      "doctor",
      "care",
      "emergency",
      "medicine",
      "patient",
    ];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("insurance")) return "insurance";
    if (lowerText.includes("emergency")) return "emergency";
    if (lowerText.includes("hospital")) return "hospitals";
    if (lowerText.includes("doctor") || lowerText.includes("gp"))
      return "doctors";
    if (lowerText.includes("pharmacy") || lowerText.includes("medicine"))
      return "pharmacy";
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
    const insuranceKeywords = [
      "insurance required",
      "mandatory insurance",
      "health coverage",
      "ehic",
      "social security",
    ];
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
    return emergencyNumbers[countryCode]
      ? JSON.stringify(emergencyNumbers[countryCode])
      : null;
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

  private async saveHealthcareInfo(item: HealthcareInfo): Promise<void> {
    await this.healthcareInfoRepository.save(item);
  }
}

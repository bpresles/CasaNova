import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Cheerio } from "cheerio";
import { Repository } from "typeorm";
import { Country } from "../../entities/country.entity.js";
import { VisaInfo } from "../../entities/visa-info.entity.js";
import {
  cleanText,
  extractListItems,
  extractText,
  fetchPage,
} from "../../scrapers/base-scraper.js";
import visaSources from "../../sources/visa-sources.json" with { type: "json" };
import type { ScrapeResult, Source, SourceMap } from "../../types/index.js";
import { DatabaseService } from "../database/database.service.js";

const sources: SourceMap = visaSources;

@Injectable()
export class VisaService {
  constructor(
    @InjectRepository(VisaInfo)
    private visaInfoRepository: Repository<VisaInfo>,
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async findAll(country?: string, type?: string, language?: string) {
    
    const queryBuilder = this.visaInfoRepository.createQueryBuilder("visa");

    if (country) {
      queryBuilder.andWhere("visa.country_code = :country", {
        country: country.toUpperCase(),
      });
    }
    if (type) {
      queryBuilder.andWhere("visa.visa_type = :type", {
        type: type.toLowerCase(),
      });
    }
    if (language) {
      queryBuilder.andWhere("visa.language = :language", {
        language: language.toLowerCase(),
      });
    }

    queryBuilder.orderBy("visa.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    return results.map((r) => ({
      ...r,
      requirements: r.requirements ? JSON.parse(r.requirements) : null,
    }));
  }

  async findCountries() {
    const results = await this.countryRepository
      .createQueryBuilder("country")
      .leftJoin("country.visas", "visa")
      .select([
        "country.code",
        "country.name",
        "country.name_fr",
        "country.region",
      ])
      .addSelect("COUNT(visa.id)", "visa_entries")
      .groupBy("country.code")
      .addGroupBy("country.name")
      .addGroupBy("country.name_fr")
      .addGroupBy("country.region")
      .orderBy("country.name", "ASC")
      .getRawMany();

    return results;
  }

  async findTypes() {
    const results = await this.visaInfoRepository
      .createQueryBuilder("visa")
      .select("visa.visa_type", "visa_type")
      .addSelect("COUNT(*)", "count")
      .groupBy("visa.visa_type")
      .orderBy("count", "DESC")
      .getRawMany();

    return results;
  }

  async findByCountry(countryCode: string, type?: string) {
    const queryBuilder = this.visaInfoRepository
      .createQueryBuilder("visa")
      .where("visa.country_code = :countryCode", {
        countryCode: countryCode.toUpperCase(),
      });

    if (type) {
      queryBuilder.andWhere("visa.visa_type = :type", {
        type: type.toLowerCase(),
      });
    }

    queryBuilder
      .orderBy("visa.visa_type")
      .addOrderBy("visa.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode.toUpperCase() },
    });

    return {
      country,
      data: results.map((r) => ({
        ...r,
        requirements: r.requirements ? JSON.parse(r.requirements) : null,
      })),
    };
  }

  async findByCountryAndType(countryCode: string, visaType: string) {
    const results = await this.visaInfoRepository.find({
      where: {
        country_code: countryCode.toUpperCase(),
        visa_type: visaType.toLowerCase(),
      },
      order: {
        updated_at: "DESC",
      },
    });

    return results.map((r) => ({
      ...r,
      requirements: r.requirements ? JSON.parse(r.requirements) : null,
    }));
  }

  async scrapeCountry(countryCode: string): Promise<VisaInfo[]> {
    const countrySources = this.getSourcesForCountry(countryCode);
    const results: VisaInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(
          `[VisaScraper] Scraping ${source.name} for ${countryCode}...`,
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
        console.error(
          `[VisaScraper] Failed to scrape ${source.name}: ${message}`,
        );
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
      await this.saveVisaInfo(item);
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
          `Failed to scrape visa info for ${country.code}: ${message}`,
        );
      }
    }

    return results;
  }

  private getSourcesForCountry(countryCode: string): Source[] {
    return sources[countryCode] || [];
  }

  private async scrapeSource(
    source: Source,
    countryCode: string,
  ): Promise<VisaInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: VisaInfo[] = [];

    $("article, .content-section, .visa-info, section").each((_, section) => {
      const $section = $(section);
      const title = extractText($section.find("h1, h2, h3").first());

      if (title) {
        const description = extractText($section.find("p").first());
        const requirements = extractListItems($, "ul li, ol li");

        if (title || description) {
          const visaInfo = new VisaInfo();
          visaInfo.country_code = countryCode;
          visaInfo.visa_type = this.inferVisaType(title);
          visaInfo.title = title || "General Visa Information";
          visaInfo.description = cleanText(description);
          visaInfo.requirements =
            requirements.length > 0 ? JSON.stringify(requirements) : null;
          visaInfo.processing_time = this.extractProcessingTime($section);
          visaInfo.cost = this.extractCost($section);
          visaInfo.validity = this.extractValidity($section);
          visaInfo.source_url = url;
          visaInfo.source_name = source.name;
          visaInfo.language = "en";

          results.push(visaInfo);
        }
      }
    });

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      const visaInfo = new VisaInfo();
      visaInfo.country_code = countryCode;
      visaInfo.visa_type = "general";
      visaInfo.title = pageTitle || `Visa Information for ${countryCode}`;
      visaInfo.description = cleanText(pageDescription);
      visaInfo.requirements = null;
      visaInfo.processing_time = null;
      visaInfo.cost = null;
      visaInfo.validity = null;
      visaInfo.source_url = url;
      visaInfo.source_name = source.name;
      visaInfo.language = "en";

      results.push(visaInfo);
    }

    return results;
  }

  private inferVisaType(text: string | null): string {
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

  private async saveVisaInfo(item: VisaInfo): Promise<void> {
    await this.visaInfoRepository.save(item);
  }
}

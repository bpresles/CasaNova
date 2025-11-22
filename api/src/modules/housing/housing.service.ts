import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Cheerio, CheerioAPI } from "cheerio";
import { Like, Repository } from "typeorm";
import { Country } from "../../entities/country.entity.js";
import { HousingInfo } from "../../entities/housing-info.entity.js";
import {
  cleanText,
  extractListItems,
  extractText,
  fetchPage,
} from "../../scrapers/base-scraper.js";
import housingSources from "../../sources/housing-sources.json" with { type: "json" };
import type {
  RentalPlatform,
  ScrapeResult,
  Source,
  SourceMap,
} from "../../types/index.js";
import { DatabaseService } from "../database/database.service.js";

const sources: SourceMap = housingSources;

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(HousingInfo)
    private housingInfoRepository: Repository<HousingInfo>,
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async findAll(
    country?: string,
    city?: string,
    category?: string,
    language?: string,
  ) {
    const queryBuilder =
      this.housingInfoRepository.createQueryBuilder("housing");

    if (country) {
      queryBuilder.andWhere("housing.country_code = :country", {
        country: country.toUpperCase(),
      });
    }
    if (city) {
      queryBuilder.andWhere("housing.city LIKE :city", {
        city: `%${city}%`,
      });
    }
    if (category) {
      queryBuilder.andWhere("housing.category = :category", {
        category: category.toLowerCase(),
      });
    }
    if (language) {
      queryBuilder.andWhere("housing.language = :language", {
        language: language.toLowerCase(),
      });
    }

    queryBuilder.orderBy("housing.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    return results.map((r) => ({
      ...r,
      required_documents: r.required_documents
        ? JSON.parse(r.required_documents)
        : null,
      tips: r.tips ? JSON.parse(r.tips) : null,
      rental_platforms: r.rental_platforms
        ? JSON.parse(r.rental_platforms)
        : null,
    }));
  }

  async findCountries() {
    const results = await this.countryRepository
      .createQueryBuilder("country")
      .leftJoin("country.housing", "housing")
      .select([
        "country.code",
        "country.name",
        "country.name_fr",
        "country.region",
      ])
      .addSelect("COUNT(housing.id)", "housing_entries")
      .groupBy("country.code")
      .addGroupBy("country.name")
      .addGroupBy("country.name_fr")
      .addGroupBy("country.region")
      .orderBy("country.name", "ASC")
      .getRawMany();

    return results;
  }

  async findCities(country?: string) {
    const queryBuilder = this.housingInfoRepository
      .createQueryBuilder("housing")
      .select("housing.city", "city")
      .addSelect("housing.country_code", "country_code")
      .addSelect("COUNT(*)", "entries")
      .where("housing.city IS NOT NULL");

    if (country) {
      queryBuilder.andWhere("housing.country_code = :country", {
        country: country.toUpperCase(),
      });
    }

    queryBuilder
      .groupBy("housing.city")
      .addGroupBy("housing.country_code")
      .orderBy("entries", "DESC");

    return await queryBuilder.getRawMany();
  }

  async findCategories() {
    const results = await this.housingInfoRepository
      .createQueryBuilder("housing")
      .select("housing.category", "category")
      .addSelect("COUNT(*)", "count")
      .groupBy("housing.category")
      .orderBy("count", "DESC")
      .getRawMany();

    return results;
  }

  async findByCountry(countryCode: string, city?: string, category?: string) {
    const queryBuilder = this.housingInfoRepository
      .createQueryBuilder("housing")
      .where("housing.country_code = :countryCode", {
        countryCode: countryCode.toUpperCase(),
      });

    if (city) {
      queryBuilder.andWhere("housing.city LIKE :city", {
        city: `%${city}%`,
      });
    }
    if (category) {
      queryBuilder.andWhere("housing.category = :category", {
        category: category.toLowerCase(),
      });
    }

    queryBuilder
      .orderBy("housing.city")
      .addOrderBy("housing.category")
      .addOrderBy("housing.updated_at", "DESC");

    const results = await queryBuilder.getMany();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode.toUpperCase() },
    });

    return {
      country,
      data: results.map((r) => ({
        ...r,
        required_documents: r.required_documents
          ? JSON.parse(r.required_documents)
          : null,
        tips: r.tips ? JSON.parse(r.tips) : null,
        rental_platforms: r.rental_platforms
          ? JSON.parse(r.rental_platforms)
          : null,
      })),
    };
  }

  async findByCountryAndCity(countryCode: string, city: string) {
    const results = await this.housingInfoRepository.find({
      where: {
        country_code: countryCode.toUpperCase(),
        city: Like(`%${city}%`),
      },
      order: {
        category: "ASC",
        updated_at: "DESC",
      },
    });

    return results.map((r) => ({
      ...r,
      required_documents: r.required_documents
        ? JSON.parse(r.required_documents)
        : null,
      tips: r.tips ? JSON.parse(r.tips) : null,
      rental_platforms: r.rental_platforms
        ? JSON.parse(r.rental_platforms)
        : null,
    }));
  }

  async scrapeCountry(countryCode: string): Promise<HousingInfo[]> {
    const countrySources = sources[countryCode] || [];
    const results: HousingInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(
          `[HousingScraper] Scraping ${source.name} for ${countryCode}...`,
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
        console.error(`[HousingScraper] Failed: ${message}`);
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
      await this.saveHousingInfo(item);
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
          `Failed to scrape housing info for ${country.code}: ${message}`,
        );
      }
    }

    return results;
  }

  private async scrapeSource(
    source: Source,
    countryCode: string,
  ): Promise<HousingInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: HousingInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each(
      (_, section) => {
        const $section = $(section);
        const title = extractText($section.find("h1, h2, h3, .title").first());

        if (title && this.isHousingRelated(title)) {
          const description = extractText($section.find("p").first());
          const tips = extractListItems($, "ul li, ol li");

          const housingInfo = new HousingInfo();
          housingInfo.country_code = countryCode;
          housingInfo.city = this.extractCity($section.text());
          housingInfo.category = this.inferCategory(title);
          housingInfo.title = title;
          housingInfo.description = cleanText(description);
          housingInfo.average_rent = this.extractRent($section.text());
          housingInfo.required_documents = this.extractDocuments($section);
          housingInfo.tips = tips.length > 0 ? JSON.stringify(tips) : null;
          housingInfo.rental_platforms = this.extractPlatforms($section, $);
          housingInfo.source_url = url;
          housingInfo.source_name = source.name;
          housingInfo.language = "en";

          results.push(housingInfo);
        }
      },
    );

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      const housingInfo = new HousingInfo();
      housingInfo.country_code = countryCode;
      housingInfo.city = null;
      housingInfo.category = "general";
      housingInfo.title = pageTitle || `Housing Information for ${countryCode}`;
      housingInfo.description = cleanText(pageDescription);
      housingInfo.average_rent = null;
      housingInfo.required_documents = null;
      housingInfo.tips = null;
      housingInfo.rental_platforms = null;
      housingInfo.source_url = url;
      housingInfo.source_name = source.name;
      housingInfo.language = "en";

      results.push(housingInfo);
    }

    return results;
  }

  private isHousingRelated(text: string | null): boolean {
    if (!text) return false;
    const keywords = [
      "housing",
      "rent",
      "apartment",
      "flat",
      "accommodation",
      "lease",
      "tenant",
      "landlord",
      "property",
      "home",
      "living",
    ];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  private inferCategory(text: string | null): string {
    if (!text) return "general";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("rent")) return "rental";
    if (lowerText.includes("buy") || lowerText.includes("purchase"))
      return "buying";
    if (lowerText.includes("student")) return "student";
    if (lowerText.includes("temporary") || lowerText.includes("short"))
      return "temporary";
    if (lowerText.includes("social")) return "social_housing";
    if (lowerText.includes("right") || lowerText.includes("law"))
      return "rights";
    return "general";
  }

  private extractCity(text: string | null): string | null {
    if (!text) return null;
    const majorCities = [
      "Paris",
      "Lyon",
      "Marseille",
      "Berlin",
      "Munich",
      "Frankfurt",
      "Hamburg",
      "Madrid",
      "Barcelona",
      "Amsterdam",
      "Rotterdam",
      "London",
      "Manchester",
      "Toronto",
      "Vancouver",
      "Montreal",
      "Sydney",
      "Melbourne",
      "New York",
      "Los Angeles",
      "Tokyo",
      "Singapore",
      "Dubai",
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
    const documentKeywords = [
      "passport",
      "id",
      "proof of income",
      "bank statement",
      "employment contract",
      "references",
      "deposit",
      "guarantor",
      "visa",
    ];
    const text = $section.text().toLowerCase();
    for (const doc of documentKeywords) {
      if (text.includes(doc)) documents.push(doc);
    }
    return documents.length > 0 ? JSON.stringify(documents) : null;
  }

  private extractPlatforms(
    $section: Cheerio<any>,
    $: CheerioAPI,
  ): string | null {
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

  private async saveHousingInfo(item: HousingInfo): Promise<void> {
    await this.housingInfoRepository.save(item);
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Cheerio } from "cheerio";
import { Repository } from "typeorm";
import { BankingInfo } from "../../entities/banking-info.entity.js";
import { Country } from "../../entities/country.entity.js";
import {
  cleanText,
  extractListItems,
  extractText,
  fetchPage,
} from "../../scrapers/base-scraper.js";
import bankingSources from "../../sources/banking-sources.json" with { type: "json" };
import type { ScrapeResult, Source, SourceMap } from "../../types/index.js";
import { DatabaseService } from "../database/database.service.js";

const sources: SourceMap = bankingSources;

@Injectable()
export class BankingService {
  constructor(
    @InjectRepository(BankingInfo)
    private bankingInfoRepository: Repository<BankingInfo>,
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async findAll(country?: string, category?: string, language?: string) {
    const queryBuilder =
      this.bankingInfoRepository.createQueryBuilder("banking");

    if (country) {
      queryBuilder.andWhere("banking.country_code = :country", {
        country: country.toUpperCase(),
      });
    }
    if (category) {
      queryBuilder.andWhere("banking.category = :category", {
        category: category.toLowerCase(),
      });
    }
    if (language) {
      queryBuilder.andWhere("banking.language = :language", {
        language: language.toLowerCase(),
      });
    }

    queryBuilder.orderBy("banking.updated_at", "DESC");
    const results = await queryBuilder.getMany();

    return results.map((r) => ({
      ...r,
      account_requirements: r.account_requirements
        ? JSON.parse(r.account_requirements)
        : null,
      recommended_banks: r.recommended_banks
        ? JSON.parse(r.recommended_banks)
        : null,
      tips: r.tips ? JSON.parse(r.tips) : null,
    }));
  }

  async findCountries() {
    const results = await this.countryRepository
      .createQueryBuilder("country")
      .leftJoin("country.banking", "banking")
      .select([
        "country.code",
        "country.name",
        "country.name_fr",
        "country.region",
      ])
      .addSelect("COUNT(banking.id)", "banking_entries")
      .groupBy("country.code")
      .addGroupBy("country.name")
      .addGroupBy("country.name_fr")
      .addGroupBy("country.region")
      .orderBy("country.name", "ASC")
      .getRawMany();

    return results;
  }

  async findCategories() {
    const results = await this.bankingInfoRepository
      .createQueryBuilder("banking")
      .select("banking.category", "category")
      .addSelect("COUNT(*)", "count")
      .groupBy("banking.category")
      .orderBy("count", "DESC")
      .getRawMany();

    return results;
  }

  async findByCountry(countryCode: string, category?: string) {
    const queryBuilder = this.bankingInfoRepository
      .createQueryBuilder("banking")
      .where("banking.country_code = :countryCode", {
        countryCode: countryCode.toUpperCase(),
      });

    if (category) {
      queryBuilder.andWhere("banking.category = :category", {
        category: category.toLowerCase(),
      });
    }

    queryBuilder
      .orderBy("banking.category")
      .addOrderBy("banking.updated_at", "DESC");

    const results = await queryBuilder.getMany();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode.toUpperCase() },
    });

    return {
      country,
      data: results.map((r) => ({
        ...r,
        account_requirements: r.account_requirements
          ? JSON.parse(r.account_requirements)
          : null,
        recommended_banks: r.recommended_banks
          ? JSON.parse(r.recommended_banks)
          : null,
        tips: r.tips ? JSON.parse(r.tips) : null,
      })),
    };
  }

  async scrapeCountry(countryCode: string): Promise<BankingInfo[]> {
    const countrySources = sources[countryCode] || [];
    const results: BankingInfo[] = [];

    for (const source of countrySources) {
      try {
        console.log(
          `[BankingScraper] Scraping ${source.name} for ${countryCode}...`,
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
        console.error(`[BankingScraper] Failed: ${message}`);
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
      await this.saveBankingInfo(item);
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
          `Failed to scrape banking info for ${country.code}: ${message}`,
        );
      }
    }

    return results;
  }

  private async scrapeSource(
    source: Source,
    countryCode: string,
  ): Promise<BankingInfo[]> {
    const { $, url } = await fetchPage(source.url);
    const results: BankingInfo[] = [];

    $("article, .content-section, section, .card, .info-block").each(
      (_, section) => {
        const $section = $(section);
        const title = extractText($section.find("h1, h2, h3, .title").first());

        if (title && this.isBankingRelated(title)) {
          const description = extractText($section.find("p").first());
          const tips = extractListItems($, "ul li, ol li");

          const bankingInfo = new BankingInfo();
          bankingInfo.country_code = countryCode;
          bankingInfo.category = this.inferCategory(title);
          bankingInfo.title = title;
          bankingInfo.description = cleanText(description);
          bankingInfo.account_requirements = this.extractRequirements($section);
          bankingInfo.recommended_banks = this.extractBanks($section);
          bankingInfo.tips = tips.length > 0 ? JSON.stringify(tips) : null;
          bankingInfo.source_url = url;
          bankingInfo.source_name = source.name;
          bankingInfo.language = "en";

          results.push(bankingInfo);
        }
      },
    );

    if (results.length === 0) {
      const pageTitle = extractText($("h1").first()) || extractText($("title"));
      const pageDescription =
        extractText($('meta[name="description"]').attr("content") || "") ||
        extractText($("p").first());

      const bankingInfo = new BankingInfo();
      bankingInfo.country_code = countryCode;
      bankingInfo.category = "general";
      bankingInfo.title = pageTitle || `Banking Information for ${countryCode}`;
      bankingInfo.description = cleanText(pageDescription);
      bankingInfo.account_requirements = null;
      bankingInfo.recommended_banks = null;
      bankingInfo.tips = null;
      bankingInfo.source_url = url;
      bankingInfo.source_name = source.name;
      bankingInfo.language = "en";

      results.push(bankingInfo);
    }

    return results;
  }

  private isBankingRelated(text: string | null): boolean {
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
      if (text.includes(req)) requirements.push(req);
    }
    return requirements.length > 0 ? JSON.stringify(requirements) : null;
  }

  private extractBanks($section: Cheerio<any>): string | null {
    const banks: string[] = [];
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
      if (text.includes(bank)) banks.push(bank);
    }
    return banks.length > 0 ? JSON.stringify(banks) : null;
  }

  private async saveBankingInfo(item: BankingInfo): Promise<void> {
    await this.bankingInfoRepository.save(item);
  }
}

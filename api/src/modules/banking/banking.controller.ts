import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { BankingService } from "./banking.service.js";

@Controller("banking")
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get()
  async findAll(
    @Query("country") country?: string,
    @Query("category") category?: string,
    @Query("language") language?: string,
  ) {
    const data = await this.bankingService.findAll(country, category, language);
    return { count: data.length, data };
  }

  @Get("countries")
  async findCountries() {
    const data = await this.bankingService.findCountries();
    return { count: data.length, data };
  }

  @Get("categories")
  async findCategories() {
    const data = await this.bankingService.findCategories();
    return { data };
  }

  @Get(":countryCode")
  async findByCountry(
    @Param("countryCode") countryCode: string,
    @Query("category") category?: string,
  ) {
    const result = await this.bankingService.findByCountry(
      countryCode,
      category,
    );
    if (result.data.length === 0) {
      return {
        error: "No banking information found for this country",
        countryCode: countryCode.toUpperCase(),
      };
    }
    return { ...result, count: result.data.length };
  }

  @Post("scrape/:countryCode")
  async scrapeCountry(@Param("countryCode") countryCode: string) {
    const results = await this.bankingService.scrapeCountry(
      countryCode.toUpperCase(),
    );
    return {
      message: `Scraped banking information for ${countryCode.toUpperCase()}`,
      itemsScraped: results.length,
      data: results,
    };
  }
}

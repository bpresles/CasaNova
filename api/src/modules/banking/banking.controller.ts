import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { BankingService } from "./banking.service.js";

@Controller("banking")
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get()
  findAll(
    @Query("country") country?: string,
    @Query("category") category?: string,
    @Query("language") language?: string
  ) {
    const data = this.bankingService.findAll(country, category, language);
    return { count: data.length, data };
  }

  @Get("countries")
  findCountries() {
    const data = this.bankingService.findCountries();
    return { count: data.length, data };
  }

  @Get("categories")
  findCategories() {
    const data = this.bankingService.findCategories();
    return { data };
  }

  @Get(":countryCode")
  findByCountry(
    @Param("countryCode") countryCode: string,
    @Query("category") category?: string
  ) {
    const result = this.bankingService.findByCountry(countryCode, category);
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
    const results = await this.bankingService.scrapeCountry(countryCode.toUpperCase());
    return {
      message: `Scraped banking information for ${countryCode.toUpperCase()}`,
      itemsScraped: results.length,
      data: results,
    };
  }
}

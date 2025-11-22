import { Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { HousingService } from "./housing.service.js";

@Controller("housing")
export class HousingController {
  constructor(@Inject(HousingService) private readonly housingService: HousingService) {}

  @Get()
  async findAll(@Query("country") country?: string, @Query("city") city?: string, @Query("category") category?: string, @Query("language") language?: string) {
    const data = await this.housingService.findAll(country, city, category, language);
    return { count: data.length, data };
  }

  @Get("countries")
  async findCountries() {
    const data = await this.housingService.findCountries();
    return { count: data.length, data };
  }

  @Get("cities")
  async findCities(@Query("country") country?: string) {
    const data = await this.housingService.findCities(country);
    return { count: data.length, data };
  }

  @Get("categories")
  async findCategories() {
    const data = await this.housingService.findCategories();
    return { data };
  }

  @Get(":countryCode")
  async findByCountry(@Param("countryCode") countryCode: string, @Query("city") city?: string, @Query("category") category?: string) {
    const result = await this.housingService.findByCountry(countryCode, city, category);
    if (result.data.length === 0) {
      return {
        error: "No housing information found for this country",
        countryCode: countryCode.toUpperCase(),
      };
    }
    return { ...result, count: result.data.length };
  }

  @Get(":countryCode/:city")
  async findByCountryAndCity(@Param("countryCode") countryCode: string, @Param("city") city: string) {
    const data = await this.housingService.findByCountryAndCity(countryCode, city);
    if (data.length === 0) {
      return {
        error: "No housing information found",
        countryCode: countryCode.toUpperCase(),
        city,
      };
    }
    return { count: data.length, data };
  }

  @Post("scrape/:countryCode")
  async scrapeCountry(@Param("countryCode") countryCode: string) {
    const results = await this.housingService.scrapeCountry(countryCode.toUpperCase());
    return {
      message: `Scraped housing information for ${countryCode.toUpperCase()}`,
      itemsScraped: results.length,
      data: results,
    };
  }
}

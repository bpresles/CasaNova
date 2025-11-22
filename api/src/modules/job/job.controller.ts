import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { JobService } from "./job.service.js";

@Controller("job")
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  findAll(
    @Query("country") country?: string,
    @Query("category") category?: string,
    @Query("language") language?: string
  ) {
    const data = this.jobService.findAll(country, category, language);
    return { count: data.length, data };
  }

  @Get("countries")
  findCountries() {
    const data = this.jobService.findCountries();
    return { count: data.length, data };
  }

  @Get("categories")
  findCategories() {
    const data = this.jobService.findCategories();
    return { data };
  }

  @Get("sectors")
  findSectors() {
    const data = this.jobService.findSectors();
    return { data };
  }

  @Get(":countryCode")
  findByCountry(
    @Param("countryCode") countryCode: string,
    @Query("category") category?: string
  ) {
    const result = this.jobService.findByCountry(countryCode, category);
    if (result.data.length === 0) {
      return {
        error: "No job information found for this country",
        countryCode: countryCode.toUpperCase(),
      };
    }
    return { ...result, count: result.data.length };
  }

  @Post("scrape/:countryCode")
  async scrapeCountry(@Param("countryCode") countryCode: string) {
    const results = await this.jobService.scrapeCountry(countryCode.toUpperCase());
    return {
      message: `Scraped job information for ${countryCode.toUpperCase()}`,
      itemsScraped: results.length,
      data: results,
    };
  }
}

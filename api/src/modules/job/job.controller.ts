import { Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { JobService } from "./job.service.js";

@Controller("job")
export class JobController {
  constructor(@Inject(JobService) private readonly jobService: JobService) {}

  @Get()
  async findAll(@Query("country") country?: string, @Query("category") category?: string, @Query("language") language?: string) {
    const data = await this.jobService.findAll(country, category, language);
    return { count: data.length, data };
  }

  @Get("countries")
  async findCountries() {
    const data = await this.jobService.findCountries();
    return { count: data.length, data };
  }

  @Get("categories")
  async findCategories() {
    const data = await this.jobService.findCategories();
    return { data };
  }

  @Get("sectors")
  async findSectors() {
    const data = await this.jobService.findSectors();
    return { data };
  }

  @Get(":countryCode")
  async findByCountry(@Param("countryCode") countryCode: string, @Query("category") category?: string) {
    const result = await this.jobService.findByCountry(countryCode, category);
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

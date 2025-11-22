import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { VisaService } from "./visa.service.js";

@Controller("visa")
export class VisaController {
  constructor(private readonly visaService: VisaService) {}

  @Get()
  async findAll(
    @Query("country") country?: string,
    @Query("type") type?: string,
    @Query("language") language?: string,
  ) {
    const data = await this.visaService.findAll(country, type, language);
    return { count: data.length, data };
  }

  @Get("countries")
  async findCountries() {
    const data = await this.visaService.findCountries();
    return { count: data.length, data };
  }

  @Get("types")
  async findTypes() {
    const data = await this.visaService.findTypes();
    return { data };
  }

  @Get(":countryCode")
  async findByCountry(
    @Param("countryCode") countryCode: string,
    @Query("type") type?: string,
  ) {
    const result = await this.visaService.findByCountry(countryCode, type);
    if (result.data.length === 0) {
      return {
        error: "No visa information found for this country",
        countryCode: countryCode.toUpperCase(),
      };
    }
    return { ...result, count: result.data.length };
  }

  @Get(":countryCode/:visaType")
  async findByCountryAndType(
    @Param("countryCode") countryCode: string,
    @Param("visaType") visaType: string,
  ) {
    const data = await this.visaService.findByCountryAndType(
      countryCode,
      visaType,
    );
    if (data.length === 0) {
      return {
        error: "No visa information found",
        countryCode: countryCode.toUpperCase(),
        visaType: visaType.toLowerCase(),
      };
    }
    return { count: data.length, data };
  }

  @Post("scrape/:countryCode")
  async scrapeCountry(@Param("countryCode") countryCode: string) {
    const results = await this.visaService.scrapeCountry(
      countryCode.toUpperCase(),
    );
    return {
      message: `Scraped visa information for ${countryCode.toUpperCase()}`,
      itemsScraped: results.length,
      data: results,
    };
  }
}

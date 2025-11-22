import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { HealthcareService } from "./healthcare.service.js";

@Controller("healthcare")
export class HealthcareController {
  constructor(private readonly healthcareService: HealthcareService) {}

  @Get()
  findAll(
    @Query("country") country?: string,
    @Query("category") category?: string,
    @Query("language") language?: string
  ) {
    const data = this.healthcareService.findAll(country, category, language);
    return { count: data.length, data };
  }

  @Get("countries")
  findCountries() {
    const data = this.healthcareService.findCountries();
    return { count: data.length, data };
  }

  @Get("emergency/:countryCode")
  findEmergencyNumbers(@Param("countryCode") countryCode: string) {
    const emergencyNumbers = this.healthcareService.findEmergencyNumbers(countryCode);
    if (!emergencyNumbers) {
      return {
        error: "No emergency numbers found for this country",
        countryCode: countryCode.toUpperCase(),
      };
    }
    return {
      countryCode: countryCode.toUpperCase(),
      emergency_numbers: emergencyNumbers,
    };
  }

  @Get(":countryCode")
  findByCountry(
    @Param("countryCode") countryCode: string,
    @Query("category") category?: string
  ) {
    const result = this.healthcareService.findByCountry(countryCode, category);
    if (result.data.length === 0) {
      return {
        error: "No healthcare information found for this country",
        countryCode: countryCode.toUpperCase(),
      };
    }
    return { ...result, count: result.data.length };
  }

  @Post("scrape/:countryCode")
  async scrapeCountry(@Param("countryCode") countryCode: string) {
    const results = await this.healthcareService.scrapeCountry(countryCode.toUpperCase());
    return {
      message: `Scraped healthcare information for ${countryCode.toUpperCase()}`,
      itemsScraped: results.length,
      data: results,
    };
  }
}

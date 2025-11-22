import { Controller, Get, Param, Query } from "@nestjs/common";
import { CountriesService } from "./countries.service.js";

@Controller("countries")
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  async findAll(@Query("region") region?: string) {
    const data = await this.countriesService.findAll(region);
    return { count: data.length, data };
  }

  @Get("regions")
  async findRegions() {
    const data = await this.countriesService.findRegions();
    return { data };
  }

  @Get(":code")
  async findByCode(@Param("code") code: string) {
    const result = await this.countriesService.findByCode(code);
    if (!result) {
      return {
        error: "Country not found",
        code: code.toUpperCase(),
      };
    }
    return result;
  }

  @Get(":code/summary")
  async findSummary(@Param("code") code: string) {
    const result = await this.countriesService.findSummary(code);
    if (!result) {
      return {
        error: "Country not found",
        code: code.toUpperCase(),
      };
    }
    return result;
  }
}

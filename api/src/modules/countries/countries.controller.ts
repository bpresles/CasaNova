import { Controller, Get, Param, Query } from "@nestjs/common";
import { CountriesService } from "./countries.service.js";

@Controller("countries")
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  findAll(@Query("region") region?: string) {
    const data = this.countriesService.findAll(region);
    return { count: data.length, data };
  }

  @Get("regions")
  findRegions() {
    const data = this.countriesService.findRegions();
    return { data };
  }

  @Get(":code")
  findByCode(@Param("code") code: string) {
    const result = this.countriesService.findByCode(code);
    if (!result) {
      return {
        error: "Country not found",
        code: code.toUpperCase(),
      };
    }
    return result;
  }

  @Get(":code/summary")
  findSummary(@Param("code") code: string) {
    const result = this.countriesService.findSummary(code);
    if (!result) {
      return {
        error: "Country not found",
        code: code.toUpperCase(),
      };
    }
    return result;
  }
}

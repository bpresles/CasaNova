import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CountriesController } from "./countries.controller.js";
import { CountriesService } from "./countries.service.js";
import { Country } from "../../entities/country.entity.js";
import { VisaInfo } from "../../entities/visa-info.entity.js";
import { JobInfo } from "../../entities/job-info.entity.js";
import { HousingInfo } from "../../entities/housing-info.entity.js";
import { HealthcareInfo } from "../../entities/healthcare-info.entity.js";
import { BankingInfo } from "../../entities/banking-info.entity.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Country,
      VisaInfo,
      JobInfo,
      HousingInfo,
      HealthcareInfo,
      BankingInfo,
    ]),
  ],
  controllers: [CountriesController],
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}

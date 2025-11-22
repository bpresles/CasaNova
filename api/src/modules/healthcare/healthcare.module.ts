import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthcareController } from "./healthcare.controller.js";
import { HealthcareService } from "./healthcare.service.js";
import { HealthcareInfo } from "../../entities/healthcare-info.entity.js";
import { Country } from "../../entities/country.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([HealthcareInfo, Country])],
  controllers: [HealthcareController],
  providers: [HealthcareService],
  exports: [HealthcareService],
})
export class HealthcareModule {}

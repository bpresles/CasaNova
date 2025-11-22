import { Module } from "@nestjs/common";
import { HealthcareController } from "./healthcare.controller.js";
import { HealthcareService } from "./healthcare.service.js";

@Module({
  controllers: [HealthcareController],
  providers: [HealthcareService],
  exports: [HealthcareService],
})
export class HealthcareModule {}

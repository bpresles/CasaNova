import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseService } from "./database.service.js";
import {
  Country,
  VisaInfo,
  JobInfo,
  HousingInfo,
  HealthcareInfo,
  BankingInfo,
  ScrapeLog,
} from "../../entities/index.js";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Country,
      VisaInfo,
      JobInfo,
      HousingInfo,
      HealthcareInfo,
      BankingInfo,
      ScrapeLog,
    ]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}

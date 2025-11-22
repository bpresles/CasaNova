import { Module } from "@nestjs/common";
import { DatabaseModule } from "./modules/database/database.module.js";
import { VisaModule } from "./modules/visa/visa.module.js";
import { JobModule } from "./modules/job/job.module.js";
import { HousingModule } from "./modules/housing/housing.module.js";
import { HealthcareModule } from "./modules/healthcare/healthcare.module.js";
import { BankingModule } from "./modules/banking/banking.module.js";
import { CountriesModule } from "./modules/countries/countries.module.js";
import { AppController } from "./app.controller.js";

@Module({
  imports: [
    DatabaseModule,
    VisaModule,
    JobModule,
    HousingModule,
    HealthcareModule,
    BankingModule,
    CountriesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

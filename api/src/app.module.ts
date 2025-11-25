import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { AppController } from "./app.controller.js";
import { BankingInfo } from "./entities/banking-info.entity.js";
import { Country } from "./entities/country.entity.js";
import { HealthcareInfo } from "./entities/healthcare-info.entity.js";
import { HousingInfo } from "./entities/housing-info.entity.js";
import { JobInfo } from "./entities/job-info.entity.js";
import { ScrapeLog } from "./entities/scrape-log.entity.js";
import { VisaInfo } from "./entities/visa-info.entity.js";
import { BankingModule } from "./modules/banking/banking.module.js";
import { CountriesModule } from "./modules/countries/countries.module.js";
import { DatabaseModule } from "./modules/database/database.module.js";
import { GeminiModule } from "./modules/gemini/gemini.module.js";
import { HealthcareModule } from "./modules/healthcare/healthcare.module.js";
import { HousingModule } from "./modules/housing/housing.module.js";
import { JobModule } from "./modules/job/job.module.js";
import { VisaModule } from "./modules/visa/visa.module.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Module({
  imports: [
    ConfigModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "client"),
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: join(__dirname, "../data/casanova.db"),
      synchronize: false,
      logging: process.env.NODE_ENV === "development",
      entities: [Country, VisaInfo, JobInfo, HousingInfo, HealthcareInfo, BankingInfo, ScrapeLog],
      migrations: [join(__dirname, "migrations/*.{ts,js}")],
    }),
    DatabaseModule,
    VisaModule,
    JobModule,
    HousingModule,
    HealthcareModule,
    BankingModule,
    CountriesModule,
    GeminiModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

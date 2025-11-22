import { DataSource } from "typeorm";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Country } from "./entities/country.entity.js";
import { VisaInfo } from "./entities/visa-info.entity.js";
import { JobInfo } from "./entities/job-info.entity.js";
import { HousingInfo } from "./entities/housing-info.entity.js";
import { HealthcareInfo } from "./entities/healthcare-info.entity.js";
import { BankingInfo } from "./entities/banking-info.entity.js";
import { ScrapeLog } from "./entities/scrape-log.entity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: join(__dirname, "../data/casanova.db"),
  synchronize: false, // Set to false in production, use migrations
  logging: process.env.NODE_ENV === "development",
  entities: [Country, VisaInfo, JobInfo, HousingInfo, HealthcareInfo, BankingInfo, ScrapeLog],
  migrations: [join(__dirname, "migrations/*.js")],
  subscribers: [],
});

import { DataSource } from "typeorm";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: join(__dirname, "../data/casanova.db"),
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  entities: [join(__dirname, "entities/*.entity.{ts,js}")],
  migrations: [join(__dirname, "migrations/*.{ts,js}")],
  subscribers: [],
});

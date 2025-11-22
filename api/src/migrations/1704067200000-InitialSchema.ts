import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1704067200000 implements MigrationInterface {
  name = "InitialSchema1704067200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create countries table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "countries" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" text NOT NULL,
        "name" text NOT NULL,
        "name_fr" text,
        "region" text,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "UQ_countries_code" UNIQUE ("code")
      )
    `);

    // Create visa_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "visa_info" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "country_code" text NOT NULL,
        "visa_type" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "requirements" text,
        "processing_time" text,
        "cost" text,
        "validity" text,
        "source_url" text,
        "source_name" text,
        "language" text NOT NULL DEFAULT ('en'),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_visa_info_country" FOREIGN KEY ("country_code") REFERENCES "countries" ("code") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create job_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_info" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "country_code" text NOT NULL,
        "category" text,
        "title" text NOT NULL,
        "description" text,
        "work_permit_required" boolean,
        "average_salary" text,
        "job_search_tips" text,
        "popular_sectors" text,
        "job_portals" text,
        "source_url" text,
        "source_name" text,
        "language" text NOT NULL DEFAULT ('en'),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_job_info_country" FOREIGN KEY ("country_code") REFERENCES "countries" ("code") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create housing_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "housing_info" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "country_code" text NOT NULL,
        "city" text,
        "category" text,
        "title" text NOT NULL,
        "description" text,
        "average_rent" text,
        "required_documents" text,
        "tips" text,
        "rental_platforms" text,
        "source_url" text,
        "source_name" text,
        "language" text NOT NULL DEFAULT ('en'),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_housing_info_country" FOREIGN KEY ("country_code") REFERENCES "countries" ("code") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create healthcare_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "healthcare_info" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "country_code" text NOT NULL,
        "category" text,
        "title" text NOT NULL,
        "description" text,
        "public_system_info" text,
        "insurance_requirements" text,
        "emergency_numbers" text,
        "useful_links" text,
        "source_url" text,
        "source_name" text,
        "language" text NOT NULL DEFAULT ('en'),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_healthcare_info_country" FOREIGN KEY ("country_code") REFERENCES "countries" ("code") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create banking_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "banking_info" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "country_code" text NOT NULL,
        "category" text,
        "title" text NOT NULL,
        "description" text,
        "account_requirements" text,
        "recommended_banks" text,
        "tips" text,
        "source_url" text,
        "source_name" text,
        "language" text NOT NULL DEFAULT ('en'),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_banking_info_country" FOREIGN KEY ("country_code") REFERENCES "countries" ("code") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create scrape_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scrape_logs" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "source_name" text NOT NULL,
        "source_url" text NOT NULL,
        "status" text NOT NULL,
        "items_scraped" integer NOT NULL DEFAULT (0),
        "error_message" text,
        "started_at" datetime NOT NULL DEFAULT (datetime('now')),
        "completed_at" datetime
      )
    `);

    // Seed initial countries
    const countries = [
      { code: "FR", name: "France", name_fr: "France", region: "Europe" },
      { code: "DE", name: "Germany", name_fr: "Allemagne", region: "Europe" },
      { code: "ES", name: "Spain", name_fr: "Espagne", region: "Europe" },
      { code: "IT", name: "Italy", name_fr: "Italie", region: "Europe" },
      { code: "PT", name: "Portugal", name_fr: "Portugal", region: "Europe" },
      { code: "NL", name: "Netherlands", name_fr: "Pays-Bas", region: "Europe" },
      { code: "BE", name: "Belgium", name_fr: "Belgique", region: "Europe" },
      { code: "CH", name: "Switzerland", name_fr: "Suisse", region: "Europe" },
      { code: "GB", name: "United Kingdom", name_fr: "Royaume-Uni", region: "Europe" },
      { code: "IE", name: "Ireland", name_fr: "Irlande", region: "Europe" },
      { code: "US", name: "United States", name_fr: "Etats-Unis", region: "North America" },
      { code: "CA", name: "Canada", name_fr: "Canada", region: "North America" },
      { code: "AU", name: "Australia", name_fr: "Australie", region: "Oceania" },
      { code: "NZ", name: "New Zealand", name_fr: "Nouvelle-Zelande", region: "Oceania" },
      { code: "JP", name: "Japan", name_fr: "Japon", region: "Asia" },
      { code: "SG", name: "Singapore", name_fr: "Singapour", region: "Asia" },
      { code: "AE", name: "United Arab Emirates", name_fr: "Emirats Arabes Unis", region: "Middle East" },
      { code: "BR", name: "Brazil", name_fr: "Bresil", region: "South America" },
      { code: "MX", name: "Mexico", name_fr: "Mexique", region: "North America" },
      { code: "MA", name: "Morocco", name_fr: "Maroc", region: "Africa" },
    ];

    for (const country of countries) {
      await queryRunner.query(
        `INSERT OR IGNORE INTO "countries" ("code", "name", "name_fr", "region") VALUES (?, ?, ?, ?)`,
        [country.code, country.name, country.name_fr, country.region]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scrape_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "banking_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "healthcare_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "housing_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "visa_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "countries"`);
  }
}

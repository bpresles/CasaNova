import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "../../data/casanova.db");
let db = null;
export function getDb() {
    if (!db) {
        db = new Database(dbPath);
        db.pragma("journal_mode = WAL");
    }
    return db;
}
export function initDatabase() {
    const database = getDb();
    // Countries table
    database.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      name_fr TEXT,
      region TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Visa information table
    database.exec(`
    CREATE TABLE IF NOT EXISTS visa_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      visa_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      requirements TEXT,
      processing_time TEXT,
      cost TEXT,
      validity TEXT,
      source_url TEXT,
      source_name TEXT,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_code) REFERENCES countries(code)
    )
  `);
    // Job market information table
    database.exec(`
    CREATE TABLE IF NOT EXISTS job_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      work_permit_required BOOLEAN,
      average_salary TEXT,
      job_search_tips TEXT,
      popular_sectors TEXT,
      job_portals TEXT,
      source_url TEXT,
      source_name TEXT,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_code) REFERENCES countries(code)
    )
  `);
    // Housing information table
    database.exec(`
    CREATE TABLE IF NOT EXISTS housing_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      city TEXT,
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      average_rent TEXT,
      required_documents TEXT,
      tips TEXT,
      rental_platforms TEXT,
      source_url TEXT,
      source_name TEXT,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_code) REFERENCES countries(code)
    )
  `);
    // Healthcare information table
    database.exec(`
    CREATE TABLE IF NOT EXISTS healthcare_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      public_system_info TEXT,
      insurance_requirements TEXT,
      emergency_numbers TEXT,
      useful_links TEXT,
      source_url TEXT,
      source_name TEXT,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_code) REFERENCES countries(code)
    )
  `);
    // Banking information table
    database.exec(`
    CREATE TABLE IF NOT EXISTS banking_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      account_requirements TEXT,
      recommended_banks TEXT,
      tips TEXT,
      source_url TEXT,
      source_name TEXT,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_code) REFERENCES countries(code)
    )
  `);
    // Scrape logs table
    database.exec(`
    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      status TEXT NOT NULL,
      items_scraped INTEGER DEFAULT 0,
      error_message TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);
    // Seed initial countries
    seedCountries(database);
    console.log("Database initialized successfully");
}
function seedCountries(database) {
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
    const insert = database.prepare(`
    INSERT OR IGNORE INTO countries (code, name, name_fr, region) VALUES (?, ?, ?, ?)
  `);
    for (const country of countries) {
        insert.run(country.code, country.name, country.name_fr, country.region);
    }
}
export function logScrape(sourceName, sourceUrl, status, itemsScraped = 0, errorMessage = null) {
    const database = getDb();
    const stmt = database.prepare(`
    INSERT INTO scrape_logs (source_name, source_url, status, items_scraped, error_message, completed_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
    stmt.run(sourceName, sourceUrl, status, itemsScraped, errorMessage);
}
//# sourceMappingURL=database.js.map
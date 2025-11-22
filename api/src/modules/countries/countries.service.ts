import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

export interface CountryRow {
  id: number;
  code: string;
  name: string;
  name_fr: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface HealthcareSummaryRow {
  title: string;
  category: string;
  emergency_numbers: string | null;
}

@Injectable()
export class CountriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(region?: string) {
    const db = this.databaseService.getDb();
    let query = "SELECT * FROM countries WHERE 1=1";
    const params: string[] = [];

    if (region) {
      query += " AND region = ?";
      params.push(region);
    }

    query += " ORDER BY name";
    return db.prepare(query).all(...params);
  }

  findRegions() {
    const db = this.databaseService.getDb();
    return db.prepare(`
      SELECT DISTINCT region, COUNT(*) as country_count
      FROM countries
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY region
    `).all();
  }

  findByCode(code: string) {
    const db = this.databaseService.getDb();
    const countryCode = code.toUpperCase();

    const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(countryCode) as CountryRow | undefined;
    if (!country) return null;

    const visaCount = (db.prepare("SELECT COUNT(*) as count FROM visa_info WHERE country_code = ?").get(countryCode) as CountRow).count;
    const jobCount = (db.prepare("SELECT COUNT(*) as count FROM job_info WHERE country_code = ?").get(countryCode) as CountRow).count;
    const housingCount = (db.prepare("SELECT COUNT(*) as count FROM housing_info WHERE country_code = ?").get(countryCode) as CountRow).count;
    const healthcareCount = (db.prepare("SELECT COUNT(*) as count FROM healthcare_info WHERE country_code = ?").get(countryCode) as CountRow).count;
    const bankingCount = (db.prepare("SELECT COUNT(*) as count FROM banking_info WHERE country_code = ?").get(countryCode) as CountRow).count;

    return {
      ...country,
      available_info: {
        visa: visaCount,
        job: jobCount,
        housing: housingCount,
        healthcare: healthcareCount,
        banking: bankingCount,
      },
      endpoints: {
        visa: `/visa/${countryCode}`,
        job: `/job/${countryCode}`,
        housing: `/housing/${countryCode}`,
        healthcare: `/healthcare/${countryCode}`,
        banking: `/banking/${countryCode}`,
      },
    };
  }

  findSummary(code: string) {
    const db = this.databaseService.getDb();
    const countryCode = code.toUpperCase();

    const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(countryCode) as CountryRow | undefined;
    if (!country) return null;

    const latestVisa = db.prepare(`
      SELECT title, visa_type, description FROM visa_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `).all(countryCode);

    const latestJob = db.prepare(`
      SELECT title, category, description FROM job_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `).all(countryCode);

    const latestHousing = db.prepare(`
      SELECT title, category, city, description FROM housing_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `).all(countryCode);

    const latestHealthcare = db.prepare(`
      SELECT title, category, emergency_numbers FROM healthcare_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `).all(countryCode) as HealthcareSummaryRow[];

    const latestBanking = db.prepare(`
      SELECT title, category, description FROM banking_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `).all(countryCode);

    return {
      country,
      summary: {
        visa: latestVisa,
        job: latestJob,
        housing: latestHousing,
        healthcare: latestHealthcare.map((h) => ({
          ...h,
          emergency_numbers: h.emergency_numbers ? JSON.parse(h.emergency_numbers) : null,
        })),
        banking: latestBanking,
      },
    };
  }
}

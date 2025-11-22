import type { CheerioAPI, Cheerio } from "cheerio";
import { BaseScraper } from "./base-scraper.js";
import { getDb } from "../db/database.js";
import type { Source, HealthcareInfo, ScrapeResult } from "../types/index.js";
export declare class HealthcareScraper extends BaseScraper {
    constructor();
    scrape(): Promise<ScrapeResult[]>;
    scrapeCountry(countryCode: string): Promise<HealthcareInfo[]>;
    getSourcesForCountry(countryCode: string): Source[];
    scrapeSource(source: Source, countryCode: string): Promise<HealthcareInfo[]>;
    isHealthcareRelated(text: string | null): boolean;
    inferCategory(text: string | null): string;
    extractPublicInfo(text: string | null): string | null;
    extractInsuranceInfo($section: Cheerio<any>, _$: CheerioAPI): string | null;
    extractEmergencyNumbers(text: string | null): string | null;
    getDefaultEmergencyNumbers(countryCode: string): string | null;
    extractLinks($section: Cheerio<any>, $: CheerioAPI): string | null;
    saveHealthcareInfo(db: ReturnType<typeof getDb>, item: HealthcareInfo): void;
}
export declare function scrapeHealthcareForCountry(countryCode: string): Promise<HealthcareInfo[]>;
export declare function scrapeAllHealthcareInfo(): Promise<ScrapeResult[]>;
//# sourceMappingURL=healthcare-scraper.d.ts.map
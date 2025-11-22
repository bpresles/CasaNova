import type { CheerioAPI, Cheerio } from "cheerio";
import { BaseScraper } from "./base-scraper.js";
import { getDb } from "../db/database.js";
import type { Source, HousingInfo, ScrapeResult } from "../types/index.js";
export declare class HousingScraper extends BaseScraper {
    constructor();
    scrape(): Promise<ScrapeResult[]>;
    scrapeCountry(countryCode: string): Promise<HousingInfo[]>;
    getSourcesForCountry(countryCode: string): Source[];
    scrapeSource(source: Source, countryCode: string): Promise<HousingInfo[]>;
    isHousingRelated(text: string | null): boolean;
    inferCategory(text: string | null): string;
    extractCity(text: string | null): string | null;
    extractRent(text: string | null): string | null;
    extractDocuments($section: Cheerio<any>, _$: CheerioAPI): string | null;
    extractPlatforms($section: Cheerio<any>, $: CheerioAPI): string | null;
    saveHousingInfo(db: ReturnType<typeof getDb>, item: HousingInfo): void;
}
export declare function scrapeHousingForCountry(countryCode: string): Promise<HousingInfo[]>;
export declare function scrapeAllHousingInfo(): Promise<ScrapeResult[]>;
//# sourceMappingURL=housing-scraper.d.ts.map
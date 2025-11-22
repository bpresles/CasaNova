import type { CheerioAPI, Cheerio } from "cheerio";
import { BaseScraper } from "./base-scraper.js";
import { getDb } from "../db/database.js";
import type { Source, VisaInfo, ScrapeResult } from "../types/index.js";
export declare class VisaScraper extends BaseScraper {
    constructor();
    scrape(): Promise<ScrapeResult[]>;
    scrapeCountry(countryCode: string): Promise<VisaInfo[]>;
    getSourcesForCountry(countryCode: string): Source[];
    scrapeSource(source: Source, countryCode: string): Promise<VisaInfo[]>;
    inferVisaType(text: string | null): string;
    extractProcessingTime($section: Cheerio<any>, _$: CheerioAPI): string | null;
    extractCost($section: Cheerio<any>, _$: CheerioAPI): string | null;
    extractValidity($section: Cheerio<any>, _$: CheerioAPI): string | null;
    saveVisaInfo(db: ReturnType<typeof getDb>, item: VisaInfo): void;
}
export declare function scrapeVisaForCountry(countryCode: string): Promise<VisaInfo[]>;
export declare function scrapeAllVisaInfo(): Promise<ScrapeResult[]>;
//# sourceMappingURL=visa-scraper.d.ts.map
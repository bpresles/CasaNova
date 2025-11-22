import type { CheerioAPI, Cheerio } from "cheerio";
import { BaseScraper } from "./base-scraper.js";
import { getDb } from "../db/database.js";
import type { Source, BankingInfo, ScrapeResult } from "../types/index.js";
export declare class BankingScraper extends BaseScraper {
    constructor();
    scrape(): Promise<ScrapeResult[]>;
    scrapeCountry(countryCode: string): Promise<BankingInfo[]>;
    getSourcesForCountry(countryCode: string): Source[];
    scrapeSource(source: Source, countryCode: string): Promise<BankingInfo[]>;
    isBankingRelated(text: string | null): boolean;
    inferCategory(text: string | null): string;
    extractRequirements($section: Cheerio<any>, _$: CheerioAPI): string | null;
    extractBanks($section: Cheerio<any>, _$: CheerioAPI): string | null;
    saveBankingInfo(db: ReturnType<typeof getDb>, item: BankingInfo): void;
}
export declare function scrapeBankingForCountry(countryCode: string): Promise<BankingInfo[]>;
export declare function scrapeAllBankingInfo(): Promise<ScrapeResult[]>;
//# sourceMappingURL=banking-scraper.d.ts.map
import type { CheerioAPI, Cheerio } from "cheerio";
import { BaseScraper } from "./base-scraper.js";
import { getDb } from "../db/database.js";
import type { Source, JobInfo, ScrapeResult } from "../types/index.js";
export declare class JobScraper extends BaseScraper {
    constructor();
    scrape(): Promise<ScrapeResult[]>;
    scrapeCountry(countryCode: string): Promise<JobInfo[]>;
    getSourcesForCountry(countryCode: string): Source[];
    scrapeSource(source: Source, countryCode: string): Promise<JobInfo[]>;
    isJobRelated(text: string | null): boolean;
    inferCategory(text: string | null): string;
    checkWorkPermitRequired(text: string | null): boolean | null;
    extractSalary(text: string | null): string | null;
    extractSectors($section: Cheerio<any>, _$: CheerioAPI): string | null;
    extractJobPortals($section: Cheerio<any>, $: CheerioAPI): string | null;
    saveJobInfo(db: ReturnType<typeof getDb>, item: JobInfo): void;
}
export declare function scrapeJobForCountry(countryCode: string): Promise<JobInfo[]>;
export declare function scrapeAllJobInfo(): Promise<ScrapeResult[]>;
//# sourceMappingURL=job-scraper.d.ts.map
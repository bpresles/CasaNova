import type { CheerioAPI, Cheerio } from "cheerio";
import type { FetchResult, FetchOptions, ExtractedLink } from "../types/index.js";
export declare function checkRobotsTxt(url: string): Promise<boolean>;
export declare function fetchPage(url: string, options?: FetchOptions): Promise<FetchResult>;
export declare function extractText($element: Cheerio<any> | string | undefined): string | null;
export declare function extractLinks($: CheerioAPI, selector: string, baseUrl: string): ExtractedLink[];
export declare function cleanText(text: string | null): string | null;
export declare function extractListItems($: CheerioAPI, selector: string): string[];
export declare abstract class BaseScraper {
    protected name: string;
    protected baseUrl: string;
    constructor(name: string, baseUrl: string);
    abstract scrape(): Promise<unknown>;
    protected log(message: string): void;
    protected error(message: string): void;
}
//# sourceMappingURL=base-scraper.d.ts.map
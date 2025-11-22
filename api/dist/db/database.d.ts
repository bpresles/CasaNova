import Database from "better-sqlite3";
export declare function getDb(): Database.Database;
export declare function initDatabase(): void;
export declare function logScrape(sourceName: string, sourceUrl: string, status: string, itemsScraped?: number, errorMessage?: string | null): void;
//# sourceMappingURL=database.d.ts.map
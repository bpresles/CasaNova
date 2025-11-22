import { initDatabase } from "../db/database.js";
import { scrapeAllHousingInfo, scrapeHousingForCountry, } from "../scrapers/housing-scraper.js";
async function main() {
    initDatabase();
    const countryCode = process.argv[2];
    if (countryCode) {
        console.log(`Scraping housing information for ${countryCode.toUpperCase()}...`);
        const results = await scrapeHousingForCountry(countryCode.toUpperCase());
        console.log(`Done! Scraped ${results.length} entries.`);
    }
    else {
        console.log("Scraping housing information for all countries...");
        const results = await scrapeAllHousingInfo();
        console.log("Done!");
        console.log("Results by country:");
        for (const result of results) {
            console.log(`  ${result.country}: ${result.count} entries`);
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=scrape-housing.js.map
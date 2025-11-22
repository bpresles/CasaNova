import { initDatabase } from "../db/database.js";
import { scrapeAllJobInfo, scrapeJobForCountry, } from "../scrapers/job-scraper.js";
async function main() {
    initDatabase();
    const countryCode = process.argv[2];
    if (countryCode) {
        console.log(`Scraping job information for ${countryCode.toUpperCase()}...`);
        const results = await scrapeJobForCountry(countryCode.toUpperCase());
        console.log(`Done! Scraped ${results.length} entries.`);
    }
    else {
        console.log("Scraping job information for all countries...");
        const results = await scrapeAllJobInfo();
        console.log("Done!");
        console.log("Results by country:");
        for (const result of results) {
            console.log(`  ${result.country}: ${result.count} entries`);
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=scrape-job.js.map
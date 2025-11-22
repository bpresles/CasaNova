import { initDatabase } from "../db/database.js";
import {
  scrapeAllVisaInfo,
  scrapeVisaForCountry,
} from "../scrapers/visa-scraper.js";

async function main(): Promise<void> {
  initDatabase();

  const countryCode = process.argv[2];

  if (countryCode) {
    console.log(`Scraping visa information for ${countryCode.toUpperCase()}...`);
    const results = await scrapeVisaForCountry(countryCode.toUpperCase());
    console.log(`Done! Scraped ${results.length} entries.`);
  } else {
    console.log("Scraping visa information for all countries...");
    const results = await scrapeAllVisaInfo();
    console.log("Done!");
    console.log("Results by country:");
    for (const result of results) {
      console.log(`  ${result.country}: ${result.count} entries`);
    }
  }
}

main().catch(console.error);

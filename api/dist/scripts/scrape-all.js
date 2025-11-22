import { initDatabase } from "../db/database.js";
import { scrapeAllVisaInfo } from "../scrapers/visa-scraper.js";
import { scrapeAllJobInfo } from "../scrapers/job-scraper.js";
import { scrapeAllHousingInfo } from "../scrapers/housing-scraper.js";
import { scrapeAllHealthcareInfo } from "../scrapers/healthcare-scraper.js";
import { scrapeAllBankingInfo } from "../scrapers/banking-scraper.js";
async function scrapeAll() {
    console.log("=".repeat(50));
    console.log("CasaNova - Full Data Scrape");
    console.log("=".repeat(50));
    console.log("");
    // Initialize database
    initDatabase();
    const results = {
        visa: [],
        job: [],
        housing: [],
        healthcare: [],
        banking: [],
    };
    console.log("[1/5] Scraping visa information...");
    try {
        results.visa = await scrapeAllVisaInfo();
        console.log(`✓ Visa: ${results.visa.length} countries processed`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`✗ Visa scraping failed: ${message}`);
    }
    console.log("");
    console.log("[2/5] Scraping job market information...");
    try {
        results.job = await scrapeAllJobInfo();
        console.log(`✓ Jobs: ${results.job.length} countries processed`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`✗ Job scraping failed: ${message}`);
    }
    console.log("");
    console.log("[3/5] Scraping housing information...");
    try {
        results.housing = await scrapeAllHousingInfo();
        console.log(`✓ Housing: ${results.housing.length} countries processed`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`✗ Housing scraping failed: ${message}`);
    }
    console.log("");
    console.log("[4/5] Scraping healthcare information...");
    try {
        results.healthcare = await scrapeAllHealthcareInfo();
        console.log(`✓ Healthcare: ${results.healthcare.length} countries processed`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`✗ Healthcare scraping failed: ${message}`);
    }
    console.log("");
    console.log("[5/5] Scraping banking information...");
    try {
        results.banking = await scrapeAllBankingInfo();
        console.log(`✓ Banking: ${results.banking.length} countries processed`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`✗ Banking scraping failed: ${message}`);
    }
    console.log("");
    console.log("=".repeat(50));
    console.log("Scraping complete!");
    console.log("=".repeat(50));
    console.log("");
    console.log("Summary:");
    console.log(`  Visa:       ${results.visa.reduce((sum, r) => sum + r.count, 0)} entries`);
    console.log(`  Jobs:       ${results.job.reduce((sum, r) => sum + r.count, 0)} entries`);
    console.log(`  Housing:    ${results.housing.reduce((sum, r) => sum + r.count, 0)} entries`);
    console.log(`  Healthcare: ${results.healthcare.reduce((sum, r) => sum + r.count, 0)} entries`);
    console.log(`  Banking:    ${results.banking.reduce((sum, r) => sum + r.count, 0)} entries`);
}
scrapeAll().catch(console.error);
//# sourceMappingURL=scrape-all.js.map
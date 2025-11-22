import { Router } from "express";
import { getDb } from "../db/database.js";
import { scrapeBankingForCountry } from "../scrapers/banking-scraper.js";
const router = Router();
// GET /banking - List all banking information
router.get("/", (req, res) => {
    const db = getDb();
    const { country, category, language } = req.query;
    let query = "SELECT * FROM banking_info WHERE 1=1";
    const params = [];
    if (country && typeof country === "string") {
        query += " AND country_code = ?";
        params.push(country.toUpperCase());
    }
    if (category && typeof category === "string") {
        query += " AND category = ?";
        params.push(category.toLowerCase());
    }
    if (language && typeof language === "string") {
        query += " AND language = ?";
        params.push(language.toLowerCase());
    }
    query += " ORDER BY updated_at DESC";
    try {
        const results = db.prepare(query).all(...params);
        const parsed = results.map((r) => ({
            ...r,
            account_requirements: r.account_requirements
                ? JSON.parse(r.account_requirements)
                : null,
            recommended_banks: r.recommended_banks
                ? JSON.parse(r.recommended_banks)
                : null,
            tips: r.tips ? JSON.parse(r.tips) : null,
        }));
        res.json({
            count: parsed.length,
            data: parsed,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// GET /banking/countries - List countries with banking info
router.get("/countries", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(b.id) as banking_entries
      FROM countries c
      LEFT JOIN banking_info b ON c.code = b.country_code
      GROUP BY c.code
      ORDER BY c.name
    `)
            .all();
        res.json({
            count: results.length,
            data: results,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// GET /banking/categories - List available banking categories
router.get("/categories", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM banking_info
      GROUP BY category
      ORDER BY count DESC
    `)
            .all();
        res.json({
            data: results,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// GET /banking/:countryCode - Get banking info for specific country
router.get("/:countryCode", (req, res) => {
    const db = getDb();
    const { countryCode } = req.params;
    const { category } = req.query;
    let query = "SELECT * FROM banking_info WHERE country_code = ?";
    const params = [countryCode.toUpperCase()];
    if (category && typeof category === "string") {
        query += " AND category = ?";
        params.push(category.toLowerCase());
    }
    query += " ORDER BY category, updated_at DESC";
    try {
        const results = db.prepare(query).all(...params);
        if (results.length === 0) {
            res.status(404).json({
                error: "No banking information found for this country",
                countryCode: countryCode.toUpperCase(),
            });
            return;
        }
        const parsed = results.map((r) => ({
            ...r,
            account_requirements: r.account_requirements
                ? JSON.parse(r.account_requirements)
                : null,
            recommended_banks: r.recommended_banks
                ? JSON.parse(r.recommended_banks)
                : null,
            tips: r.tips ? JSON.parse(r.tips) : null,
        }));
        const country = db
            .prepare("SELECT * FROM countries WHERE code = ?")
            .get(countryCode.toUpperCase());
        res.json({
            country,
            count: parsed.length,
            data: parsed,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// POST /banking/scrape/:countryCode - Trigger scraping for a country
router.post("/scrape/:countryCode", async (req, res) => {
    const { countryCode } = req.params;
    try {
        const results = await scrapeBankingForCountry(countryCode.toUpperCase());
        res.json({
            message: `Scraped banking information for ${countryCode.toUpperCase()}`,
            itemsScraped: results.length,
            data: results,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
export default router;
//# sourceMappingURL=banking.js.map
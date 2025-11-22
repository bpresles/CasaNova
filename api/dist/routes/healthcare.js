import { Router } from "express";
import { getDb } from "../db/database.js";
import { scrapeHealthcareForCountry } from "../scrapers/healthcare-scraper.js";
const router = Router();
// GET /healthcare - List all healthcare information
router.get("/", (req, res) => {
    const db = getDb();
    const { country, category, language } = req.query;
    let query = "SELECT * FROM healthcare_info WHERE 1=1";
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
            insurance_requirements: r.insurance_requirements
                ? JSON.parse(r.insurance_requirements)
                : null,
            emergency_numbers: r.emergency_numbers
                ? JSON.parse(r.emergency_numbers)
                : null,
            useful_links: r.useful_links ? JSON.parse(r.useful_links) : null,
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
// GET /healthcare/countries - List countries with healthcare info
router.get("/countries", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(h.id) as healthcare_entries
      FROM countries c
      LEFT JOIN healthcare_info h ON c.code = h.country_code
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
// GET /healthcare/emergency/:countryCode - Get emergency numbers for country
router.get("/emergency/:countryCode", (req, res) => {
    const db = getDb();
    const { countryCode } = req.params;
    try {
        const result = db
            .prepare(`
      SELECT emergency_numbers
      FROM healthcare_info
      WHERE country_code = ? AND emergency_numbers IS NOT NULL
      LIMIT 1
    `)
            .get(countryCode.toUpperCase());
        if (!result) {
            res.status(404).json({
                error: "No emergency numbers found for this country",
                countryCode: countryCode.toUpperCase(),
            });
            return;
        }
        res.json({
            countryCode: countryCode.toUpperCase(),
            emergency_numbers: JSON.parse(result.emergency_numbers),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// GET /healthcare/:countryCode - Get healthcare info for specific country
router.get("/:countryCode", (req, res) => {
    const db = getDb();
    const { countryCode } = req.params;
    const { category } = req.query;
    let query = "SELECT * FROM healthcare_info WHERE country_code = ?";
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
                error: "No healthcare information found for this country",
                countryCode: countryCode.toUpperCase(),
            });
            return;
        }
        const parsed = results.map((r) => ({
            ...r,
            insurance_requirements: r.insurance_requirements
                ? JSON.parse(r.insurance_requirements)
                : null,
            emergency_numbers: r.emergency_numbers
                ? JSON.parse(r.emergency_numbers)
                : null,
            useful_links: r.useful_links ? JSON.parse(r.useful_links) : null,
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
// POST /healthcare/scrape/:countryCode - Trigger scraping for a country
router.post("/scrape/:countryCode", async (req, res) => {
    const { countryCode } = req.params;
    try {
        const results = await scrapeHealthcareForCountry(countryCode.toUpperCase());
        res.json({
            message: `Scraped healthcare information for ${countryCode.toUpperCase()}`,
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
//# sourceMappingURL=healthcare.js.map
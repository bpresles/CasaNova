import { Router } from "express";
import { getDb } from "../db/database.js";
import { scrapeVisaForCountry } from "../scrapers/visa-scraper.js";
const router = Router();
// GET /visa - List all visa information
router.get("/", (req, res) => {
    const db = getDb();
    const { country, type, language } = req.query;
    let query = "SELECT * FROM visa_info WHERE 1=1";
    const params = [];
    if (country && typeof country === "string") {
        query += " AND country_code = ?";
        params.push(country.toUpperCase());
    }
    if (type && typeof type === "string") {
        query += " AND visa_type = ?";
        params.push(type.toLowerCase());
    }
    if (language && typeof language === "string") {
        query += " AND language = ?";
        params.push(language.toLowerCase());
    }
    query += " ORDER BY updated_at DESC";
    try {
        const results = db.prepare(query).all(...params);
        // Parse JSON fields
        const parsed = results.map((r) => ({
            ...r,
            requirements: r.requirements ? JSON.parse(r.requirements) : null,
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
// GET /visa/countries - List countries with visa info
router.get("/countries", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(v.id) as visa_entries
      FROM countries c
      LEFT JOIN visa_info v ON c.code = v.country_code
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
// GET /visa/types - List available visa types
router.get("/types", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT visa_type, COUNT(*) as count
      FROM visa_info
      GROUP BY visa_type
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
// GET /visa/:countryCode - Get visa info for specific country
router.get("/:countryCode", (req, res) => {
    const db = getDb();
    const { countryCode } = req.params;
    const { type } = req.query;
    let query = "SELECT * FROM visa_info WHERE country_code = ?";
    const params = [countryCode.toUpperCase()];
    if (type && typeof type === "string") {
        query += " AND visa_type = ?";
        params.push(type.toLowerCase());
    }
    query += " ORDER BY visa_type, updated_at DESC";
    try {
        const results = db.prepare(query).all(...params);
        if (results.length === 0) {
            res.status(404).json({
                error: "No visa information found for this country",
                countryCode: countryCode.toUpperCase(),
            });
            return;
        }
        // Parse JSON fields
        const parsed = results.map((r) => ({
            ...r,
            requirements: r.requirements ? JSON.parse(r.requirements) : null,
        }));
        // Get country details
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
// GET /visa/:countryCode/:visaType - Get specific visa type for country
router.get("/:countryCode/:visaType", (req, res) => {
    const db = getDb();
    const { countryCode, visaType } = req.params;
    try {
        const results = db
            .prepare(`
      SELECT * FROM visa_info
      WHERE country_code = ? AND visa_type = ?
      ORDER BY updated_at DESC
    `)
            .all(countryCode.toUpperCase(), visaType.toLowerCase());
        if (results.length === 0) {
            res.status(404).json({
                error: "No visa information found",
                countryCode: countryCode.toUpperCase(),
                visaType: visaType.toLowerCase(),
            });
            return;
        }
        // Parse JSON fields
        const parsed = results.map((r) => ({
            ...r,
            requirements: r.requirements ? JSON.parse(r.requirements) : null,
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
// POST /visa/scrape/:countryCode - Trigger scraping for a country
router.post("/scrape/:countryCode", async (req, res) => {
    const { countryCode } = req.params;
    try {
        const results = await scrapeVisaForCountry(countryCode.toUpperCase());
        res.json({
            message: `Scraped visa information for ${countryCode.toUpperCase()}`,
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
//# sourceMappingURL=visa.js.map
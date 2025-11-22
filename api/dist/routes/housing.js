import { Router } from "express";
import { getDb } from "../db/database.js";
import { scrapeHousingForCountry } from "../scrapers/housing-scraper.js";
const router = Router();
// GET /housing - List all housing information
router.get("/", (req, res) => {
    const db = getDb();
    const { country, city, category, language } = req.query;
    let query = "SELECT * FROM housing_info WHERE 1=1";
    const params = [];
    if (country && typeof country === "string") {
        query += " AND country_code = ?";
        params.push(country.toUpperCase());
    }
    if (city && typeof city === "string") {
        query += " AND city LIKE ?";
        params.push(`%${city}%`);
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
            required_documents: r.required_documents
                ? JSON.parse(r.required_documents)
                : null,
            tips: r.tips ? JSON.parse(r.tips) : null,
            rental_platforms: r.rental_platforms
                ? JSON.parse(r.rental_platforms)
                : null,
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
// GET /housing/countries - List countries with housing info
router.get("/countries", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(h.id) as housing_entries
      FROM countries c
      LEFT JOIN housing_info h ON c.code = h.country_code
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
// GET /housing/cities - List cities with housing info
router.get("/cities", (req, res) => {
    const db = getDb();
    const { country } = req.query;
    let query = `
    SELECT DISTINCT city, country_code, COUNT(*) as entries
    FROM housing_info
    WHERE city IS NOT NULL
  `;
    const params = [];
    if (country && typeof country === "string") {
        query += " AND country_code = ?";
        params.push(country.toUpperCase());
    }
    query += " GROUP BY city, country_code ORDER BY entries DESC";
    try {
        const results = db.prepare(query).all(...params);
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
// GET /housing/categories - List available housing categories
router.get("/categories", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM housing_info
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
// GET /housing/:countryCode - Get housing info for specific country
router.get("/:countryCode", (req, res) => {
    const db = getDb();
    const { countryCode } = req.params;
    const { city, category } = req.query;
    let query = "SELECT * FROM housing_info WHERE country_code = ?";
    const params = [countryCode.toUpperCase()];
    if (city && typeof city === "string") {
        query += " AND city LIKE ?";
        params.push(`%${city}%`);
    }
    if (category && typeof category === "string") {
        query += " AND category = ?";
        params.push(category.toLowerCase());
    }
    query += " ORDER BY city, category, updated_at DESC";
    try {
        const results = db.prepare(query).all(...params);
        if (results.length === 0) {
            res.status(404).json({
                error: "No housing information found for this country",
                countryCode: countryCode.toUpperCase(),
            });
            return;
        }
        const parsed = results.map((r) => ({
            ...r,
            required_documents: r.required_documents
                ? JSON.parse(r.required_documents)
                : null,
            tips: r.tips ? JSON.parse(r.tips) : null,
            rental_platforms: r.rental_platforms
                ? JSON.parse(r.rental_platforms)
                : null,
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
// GET /housing/:countryCode/:city - Get housing info for specific city
router.get("/:countryCode/:city", (req, res) => {
    const db = getDb();
    const { countryCode, city } = req.params;
    try {
        const results = db
            .prepare(`
      SELECT * FROM housing_info
      WHERE country_code = ? AND city LIKE ?
      ORDER BY category, updated_at DESC
    `)
            .all(countryCode.toUpperCase(), `%${city}%`);
        if (results.length === 0) {
            res.status(404).json({
                error: "No housing information found",
                countryCode: countryCode.toUpperCase(),
                city,
            });
            return;
        }
        const parsed = results.map((r) => ({
            ...r,
            required_documents: r.required_documents
                ? JSON.parse(r.required_documents)
                : null,
            tips: r.tips ? JSON.parse(r.tips) : null,
            rental_platforms: r.rental_platforms
                ? JSON.parse(r.rental_platforms)
                : null,
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
// POST /housing/scrape/:countryCode - Trigger scraping for a country
router.post("/scrape/:countryCode", async (req, res) => {
    const { countryCode } = req.params;
    try {
        const results = await scrapeHousingForCountry(countryCode.toUpperCase());
        res.json({
            message: `Scraped housing information for ${countryCode.toUpperCase()}`,
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
//# sourceMappingURL=housing.js.map
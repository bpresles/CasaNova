import { Router } from "express";
import { getDb } from "../db/database.js";
import { scrapeJobForCountry } from "../scrapers/job-scraper.js";
const router = Router();
// GET /job - List all job market information
router.get("/", (req, res) => {
    const db = getDb();
    const { country, category, language } = req.query;
    let query = "SELECT * FROM job_info WHERE 1=1";
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
            job_search_tips: r.job_search_tips ? JSON.parse(r.job_search_tips) : null,
            popular_sectors: r.popular_sectors ? JSON.parse(r.popular_sectors) : null,
            job_portals: r.job_portals ? JSON.parse(r.job_portals) : null,
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
// GET /job/countries - List countries with job info
router.get("/countries", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT c.code, c.name, c.name_fr, c.region,
             COUNT(j.id) as job_entries
      FROM countries c
      LEFT JOIN job_info j ON c.code = j.country_code
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
// GET /job/categories - List available job categories
router.get("/categories", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM job_info
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
// GET /job/sectors - Get popular sectors across all countries
router.get("/sectors", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT country_code, popular_sectors
      FROM job_info
      WHERE popular_sectors IS NOT NULL
    `)
            .all();
        // Aggregate sectors
        const sectorCounts = {};
        for (const row of results) {
            const sectors = JSON.parse(row.popular_sectors);
            for (const sector of sectors) {
                sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
            }
        }
        const sectors = Object.entries(sectorCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        res.json({
            data: sectors,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// GET /job/:countryCode - Get job info for specific country
router.get("/:countryCode", (req, res) => {
    const db = getDb();
    const { countryCode } = req.params;
    const { category } = req.query;
    let query = "SELECT * FROM job_info WHERE country_code = ?";
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
                error: "No job information found for this country",
                countryCode: countryCode.toUpperCase(),
            });
            return;
        }
        const parsed = results.map((r) => ({
            ...r,
            job_search_tips: r.job_search_tips ? JSON.parse(r.job_search_tips) : null,
            popular_sectors: r.popular_sectors ? JSON.parse(r.popular_sectors) : null,
            job_portals: r.job_portals ? JSON.parse(r.job_portals) : null,
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
// POST /job/scrape/:countryCode - Trigger scraping for a country
router.post("/scrape/:countryCode", async (req, res) => {
    const { countryCode } = req.params;
    try {
        const results = await scrapeJobForCountry(countryCode.toUpperCase());
        res.json({
            message: `Scraped job information for ${countryCode.toUpperCase()}`,
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
//# sourceMappingURL=job.js.map
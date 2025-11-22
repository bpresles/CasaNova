import { Router } from "express";
import { getDb } from "../db/database.js";
const router = Router();
// GET /countries - List all countries
router.get("/", (req, res) => {
    const db = getDb();
    const { region } = req.query;
    let query = "SELECT * FROM countries WHERE 1=1";
    const params = [];
    if (region && typeof region === "string") {
        query += " AND region = ?";
        params.push(region);
    }
    query += " ORDER BY name";
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
// GET /countries/regions - List all regions
router.get("/regions", (_req, res) => {
    const db = getDb();
    try {
        const results = db
            .prepare(`
      SELECT DISTINCT region, COUNT(*) as country_count
      FROM countries
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY region
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
// GET /countries/:code - Get country details with all available info
router.get("/:code", (req, res) => {
    const db = getDb();
    const { code } = req.params;
    const countryCode = code.toUpperCase();
    try {
        const country = db
            .prepare("SELECT * FROM countries WHERE code = ?")
            .get(countryCode);
        if (!country) {
            res.status(404).json({
                error: "Country not found",
                code: countryCode,
            });
            return;
        }
        // Get counts for each information type
        const visaCount = db
            .prepare("SELECT COUNT(*) as count FROM visa_info WHERE country_code = ?")
            .get(countryCode).count;
        const jobCount = db
            .prepare("SELECT COUNT(*) as count FROM job_info WHERE country_code = ?")
            .get(countryCode).count;
        const housingCount = db
            .prepare("SELECT COUNT(*) as count FROM housing_info WHERE country_code = ?")
            .get(countryCode).count;
        const healthcareCount = db
            .prepare("SELECT COUNT(*) as count FROM healthcare_info WHERE country_code = ?")
            .get(countryCode).count;
        const bankingCount = db
            .prepare("SELECT COUNT(*) as count FROM banking_info WHERE country_code = ?")
            .get(countryCode).count;
        res.json({
            ...country,
            available_info: {
                visa: visaCount,
                job: jobCount,
                housing: housingCount,
                healthcare: healthcareCount,
                banking: bankingCount,
            },
            endpoints: {
                visa: `/visa/${countryCode}`,
                job: `/job/${countryCode}`,
                housing: `/housing/${countryCode}`,
                healthcare: `/healthcare/${countryCode}`,
                banking: `/banking/${countryCode}`,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
// GET /countries/:code/summary - Get a summary of all info for a country
router.get("/:code/summary", (req, res) => {
    const db = getDb();
    const { code } = req.params;
    const countryCode = code.toUpperCase();
    try {
        const country = db
            .prepare("SELECT * FROM countries WHERE code = ?")
            .get(countryCode);
        if (!country) {
            res.status(404).json({
                error: "Country not found",
                code: countryCode,
            });
            return;
        }
        // Get latest entry from each category
        const latestVisa = db
            .prepare(`
      SELECT title, visa_type, description FROM visa_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `)
            .all(countryCode);
        const latestJob = db
            .prepare(`
      SELECT title, category, description FROM job_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `)
            .all(countryCode);
        const latestHousing = db
            .prepare(`
      SELECT title, category, city, description FROM housing_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `)
            .all(countryCode);
        const latestHealthcare = db
            .prepare(`
      SELECT title, category, emergency_numbers FROM healthcare_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `)
            .all(countryCode);
        const latestBanking = db
            .prepare(`
      SELECT title, category, description FROM banking_info
      WHERE country_code = ? ORDER BY updated_at DESC LIMIT 3
    `)
            .all(countryCode);
        res.json({
            country,
            summary: {
                visa: latestVisa,
                job: latestJob,
                housing: latestHousing,
                healthcare: latestHealthcare.map((h) => ({
                    ...h,
                    emergency_numbers: h.emergency_numbers
                        ? JSON.parse(h.emergency_numbers)
                        : null,
                })),
                banking: latestBanking,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
export default router;
//# sourceMappingURL=countries.js.map
import { BaseScraper, fetchPage, extractText, cleanText, extractListItems, } from "./base-scraper.js";
import { getDb, logScrape } from "../db/database.js";
import jobSources from "../sources/job-sources.json" with { type: "json" };
const sources = jobSources;
export class JobScraper extends BaseScraper {
    constructor() {
        super("JobScraper", "https://eures.europa.eu");
    }
    async scrape() {
        return scrapeAllJobInfo();
    }
    async scrapeCountry(countryCode) {
        const db = getDb();
        const countrySources = this.getSourcesForCountry(countryCode);
        const results = [];
        for (const source of countrySources) {
            try {
                this.log(`Scraping ${source.name} for ${countryCode}...`);
                const data = await this.scrapeSource(source, countryCode);
                results.push(...data);
                logScrape(source.name, source.url, "success", data.length);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                this.error(`Failed to scrape ${source.name}: ${message}`);
                logScrape(source.name, source.url, "error", 0, message);
            }
        }
        for (const item of results) {
            this.saveJobInfo(db, item);
        }
        return results;
    }
    getSourcesForCountry(countryCode) {
        return sources[countryCode] || [];
    }
    async scrapeSource(source, countryCode) {
        const { $, url } = await fetchPage(source.url);
        const results = [];
        // Extract job market information sections
        $("article, .content-section, section, .card, .info-block").each((_, section) => {
            const $section = $(section);
            const title = extractText($section.find("h1, h2, h3, .title").first());
            if (title && this.isJobRelated(title)) {
                const description = extractText($section.find("p").first());
                const tips = extractListItems($, "ul li, ol li");
                results.push({
                    country_code: countryCode,
                    category: this.inferCategory(title),
                    title: title,
                    description: cleanText(description),
                    work_permit_required: this.checkWorkPermitRequired($section.text()),
                    average_salary: this.extractSalary($section.text()),
                    job_search_tips: tips.length > 0 ? JSON.stringify(tips) : null,
                    popular_sectors: this.extractSectors($section, $),
                    job_portals: this.extractJobPortals($section, $),
                    source_url: url,
                    source_name: source.name,
                    language: "en",
                });
            }
        });
        // If no structured content found, create a basic entry
        if (results.length === 0) {
            const pageTitle = extractText($("h1").first()) || extractText($("title"));
            const pageDescription = extractText($('meta[name="description"]').attr("content") || "") ||
                extractText($("p").first());
            results.push({
                country_code: countryCode,
                category: "general",
                title: pageTitle || `Job Market Information for ${countryCode}`,
                description: cleanText(pageDescription),
                work_permit_required: null,
                average_salary: null,
                job_search_tips: null,
                popular_sectors: null,
                job_portals: null,
                source_url: url,
                source_name: source.name,
                language: "en",
            });
        }
        return results;
    }
    isJobRelated(text) {
        if (!text)
            return false;
        const keywords = [
            "job",
            "work",
            "employment",
            "career",
            "salary",
            "hiring",
            "recruit",
            "labour",
            "labor",
            "profession",
        ];
        const lowerText = text.toLowerCase();
        return keywords.some((kw) => lowerText.includes(kw));
    }
    inferCategory(text) {
        if (!text)
            return "general";
        const lowerText = text.toLowerCase();
        if (lowerText.includes("permit") || lowerText.includes("authorization"))
            return "work_permit";
        if (lowerText.includes("salary") || lowerText.includes("wage"))
            return "salary";
        if (lowerText.includes("search") || lowerText.includes("find"))
            return "job_search";
        if (lowerText.includes("sector") || lowerText.includes("industry"))
            return "sectors";
        if (lowerText.includes("right") || lowerText.includes("law"))
            return "rights";
        if (lowerText.includes("contract"))
            return "contracts";
        return "general";
    }
    checkWorkPermitRequired(text) {
        if (!text)
            return null;
        const lowerText = text.toLowerCase();
        if (lowerText.includes("work permit required") ||
            lowerText.includes("need a work permit"))
            return true;
        if (lowerText.includes("no work permit") ||
            lowerText.includes("without permit"))
            return false;
        return null;
    }
    extractSalary(text) {
        if (!text)
            return null;
        const patterns = [
            /average\s+salary[:\s]+[€$£]?\s*[\d,]+/i,
            /minimum\s+wage[:\s]+[€$£]?\s*[\d,]+/i,
            /[€$£]\s*[\d,]+\s*(?:per\s+)?(?:month|year|hour)/i,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match)
                return match[0];
        }
        return null;
    }
    extractSectors($section, _$) {
        const sectors = [];
        const sectorKeywords = [
            "technology",
            "healthcare",
            "finance",
            "engineering",
            "tourism",
            "education",
            "manufacturing",
            "agriculture",
            "retail",
            "construction",
        ];
        const text = $section.text().toLowerCase();
        for (const sector of sectorKeywords) {
            if (text.includes(sector)) {
                sectors.push(sector);
            }
        }
        return sectors.length > 0 ? JSON.stringify(sectors) : null;
    }
    extractJobPortals($section, $) {
        const portals = [];
        $section.find("a").each((_, el) => {
            const href = $(el).attr("href");
            const text = extractText($(el));
            if (href && (text?.toLowerCase().includes("job") || href.includes("job"))) {
                portals.push({ name: text, url: href });
            }
        });
        return portals.length > 0 ? JSON.stringify(portals) : null;
    }
    saveJobInfo(db, item) {
        const stmt = db.prepare(`
      INSERT INTO job_info (
        country_code, category, title, description, work_permit_required,
        average_salary, job_search_tips, popular_sectors, job_portals,
        source_url, source_name, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(item.country_code, item.category, item.title, item.description, item.work_permit_required, item.average_salary, item.job_search_tips, item.popular_sectors, item.job_portals, item.source_url, item.source_name, item.language);
    }
}
export async function scrapeJobForCountry(countryCode) {
    const scraper = new JobScraper();
    return scraper.scrapeCountry(countryCode);
}
export async function scrapeAllJobInfo() {
    const db = getDb();
    const countries = db
        .prepare("SELECT code FROM countries")
        .all();
    const scraper = new JobScraper();
    const results = [];
    for (const country of countries) {
        try {
            const data = await scraper.scrapeCountry(country.code);
            results.push({ country: country.code, count: data.length });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to scrape job info for ${country.code}: ${message}`);
        }
    }
    return results;
}
//# sourceMappingURL=job-scraper.js.map
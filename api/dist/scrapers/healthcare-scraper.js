import { BaseScraper, fetchPage, extractText, cleanText, extractListItems, } from "./base-scraper.js";
import { getDb, logScrape } from "../db/database.js";
import healthcareSources from "../sources/healthcare-sources.json" with { type: "json" };
const sources = healthcareSources;
export class HealthcareScraper extends BaseScraper {
    constructor() {
        super("HealthcareScraper", "https://www.internations.org");
    }
    async scrape() {
        return scrapeAllHealthcareInfo();
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
            this.saveHealthcareInfo(db, item);
        }
        return results;
    }
    getSourcesForCountry(countryCode) {
        return sources[countryCode] || [];
    }
    async scrapeSource(source, countryCode) {
        const { $, url } = await fetchPage(source.url);
        const results = [];
        $("article, .content-section, section, .card, .info-block").each((_, section) => {
            const $section = $(section);
            const title = extractText($section.find("h1, h2, h3, .title").first());
            if (title && this.isHealthcareRelated(title)) {
                const description = extractText($section.find("p").first());
                extractListItems($, "ul li, ol li");
                results.push({
                    country_code: countryCode,
                    category: this.inferCategory(title),
                    title: title,
                    description: cleanText(description),
                    public_system_info: this.extractPublicInfo($section.text()),
                    insurance_requirements: this.extractInsuranceInfo($section, $),
                    emergency_numbers: this.extractEmergencyNumbers($section.text()),
                    useful_links: this.extractLinks($section, $),
                    source_url: url,
                    source_name: source.name,
                    language: "en",
                });
            }
        });
        if (results.length === 0) {
            const pageTitle = extractText($("h1").first()) || extractText($("title"));
            const pageDescription = extractText($('meta[name="description"]').attr("content") || "") ||
                extractText($("p").first());
            results.push({
                country_code: countryCode,
                category: "general",
                title: pageTitle || `Healthcare Information for ${countryCode}`,
                description: cleanText(pageDescription),
                public_system_info: null,
                insurance_requirements: null,
                emergency_numbers: this.getDefaultEmergencyNumbers(countryCode),
                useful_links: null,
                source_url: url,
                source_name: source.name,
                language: "en",
            });
        }
        return results;
    }
    isHealthcareRelated(text) {
        if (!text)
            return false;
        const keywords = [
            "health",
            "medical",
            "insurance",
            "hospital",
            "doctor",
            "care",
            "emergency",
            "medicine",
            "patient",
        ];
        const lowerText = text.toLowerCase();
        return keywords.some((kw) => lowerText.includes(kw));
    }
    inferCategory(text) {
        if (!text)
            return "general";
        const lowerText = text.toLowerCase();
        if (lowerText.includes("insurance"))
            return "insurance";
        if (lowerText.includes("emergency"))
            return "emergency";
        if (lowerText.includes("hospital"))
            return "hospitals";
        if (lowerText.includes("doctor") || lowerText.includes("gp"))
            return "doctors";
        if (lowerText.includes("pharmacy") || lowerText.includes("medicine"))
            return "pharmacy";
        if (lowerText.includes("dental"))
            return "dental";
        return "general";
    }
    extractPublicInfo(text) {
        if (!text)
            return null;
        const patterns = [
            /public\s+health\s+(?:system|care|insurance)[^.]+\./i,
            /national\s+health[^.]+\./i,
            /universal\s+(?:health)?care[^.]+\./i,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match)
                return match[0];
        }
        return null;
    }
    extractInsuranceInfo($section, _$) {
        const requirements = [];
        const insuranceKeywords = [
            "insurance required",
            "mandatory insurance",
            "health coverage",
            "ehic",
            "social security",
        ];
        const text = $section.text().toLowerCase();
        for (const req of insuranceKeywords) {
            if (text.includes(req)) {
                requirements.push(req);
            }
        }
        return requirements.length > 0 ? JSON.stringify(requirements) : null;
    }
    extractEmergencyNumbers(text) {
        if (!text)
            return null;
        const numbers = [];
        const patterns = [
            /emergency[:\s]+(\d{2,3})/i,
            /ambulance[:\s]+(\d{2,3})/i,
            /(\d{3})\s*(?:emergency|ambulance)/i,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                numbers.push(match[0]);
            }
        }
        return numbers.length > 0 ? JSON.stringify(numbers) : null;
    }
    getDefaultEmergencyNumbers(countryCode) {
        const emergencyNumbers = {
            FR: { emergency: "112", samu: "15", police: "17", fire: "18" },
            DE: { emergency: "112", police: "110" },
            ES: { emergency: "112" },
            IT: { emergency: "112", carabinieri: "112" },
            GB: { emergency: "999", nhs: "111" },
            US: { emergency: "911" },
            CA: { emergency: "911" },
            AU: { emergency: "000" },
        };
        return emergencyNumbers[countryCode]
            ? JSON.stringify(emergencyNumbers[countryCode])
            : null;
    }
    extractLinks($section, $) {
        const links = [];
        $section.find("a").each((_, el) => {
            const href = $(el).attr("href");
            const text = extractText($(el));
            if (href && this.isHealthcareRelated(text || href)) {
                links.push({ name: text, url: href });
            }
        });
        return links.length > 0 ? JSON.stringify(links) : null;
    }
    saveHealthcareInfo(db, item) {
        const stmt = db.prepare(`
      INSERT INTO healthcare_info (
        country_code, category, title, description, public_system_info,
        insurance_requirements, emergency_numbers, useful_links,
        source_url, source_name, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(item.country_code, item.category, item.title, item.description, item.public_system_info, item.insurance_requirements, item.emergency_numbers, item.useful_links, item.source_url, item.source_name, item.language);
    }
}
export async function scrapeHealthcareForCountry(countryCode) {
    const scraper = new HealthcareScraper();
    return scraper.scrapeCountry(countryCode);
}
export async function scrapeAllHealthcareInfo() {
    const db = getDb();
    const countries = db
        .prepare("SELECT code FROM countries")
        .all();
    const scraper = new HealthcareScraper();
    const results = [];
    for (const country of countries) {
        try {
            const data = await scraper.scrapeCountry(country.code);
            results.push({ country: country.code, count: data.length });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to scrape healthcare info for ${country.code}: ${message}`);
        }
    }
    return results;
}
//# sourceMappingURL=healthcare-scraper.js.map
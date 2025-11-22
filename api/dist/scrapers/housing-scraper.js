import { BaseScraper, fetchPage, extractText, cleanText, extractListItems, } from "./base-scraper.js";
import { getDb, logScrape } from "../db/database.js";
import housingSources from "../sources/housing-sources.json" with { type: "json" };
const sources = housingSources;
export class HousingScraper extends BaseScraper {
    constructor() {
        super("HousingScraper", "https://www.expatica.com");
    }
    async scrape() {
        return scrapeAllHousingInfo();
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
            this.saveHousingInfo(db, item);
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
            if (title && this.isHousingRelated(title)) {
                const description = extractText($section.find("p").first());
                const tips = extractListItems($, "ul li, ol li");
                results.push({
                    country_code: countryCode,
                    city: this.extractCity($section.text()),
                    category: this.inferCategory(title),
                    title: title,
                    description: cleanText(description),
                    average_rent: this.extractRent($section.text()),
                    required_documents: this.extractDocuments($section, $),
                    tips: tips.length > 0 ? JSON.stringify(tips) : null,
                    rental_platforms: this.extractPlatforms($section, $),
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
                city: null,
                category: "general",
                title: pageTitle || `Housing Information for ${countryCode}`,
                description: cleanText(pageDescription),
                average_rent: null,
                required_documents: null,
                tips: null,
                rental_platforms: null,
                source_url: url,
                source_name: source.name,
                language: "en",
            });
        }
        return results;
    }
    isHousingRelated(text) {
        if (!text)
            return false;
        const keywords = [
            "housing",
            "rent",
            "apartment",
            "flat",
            "accommodation",
            "lease",
            "tenant",
            "landlord",
            "property",
            "home",
            "living",
        ];
        const lowerText = text.toLowerCase();
        return keywords.some((kw) => lowerText.includes(kw));
    }
    inferCategory(text) {
        if (!text)
            return "general";
        const lowerText = text.toLowerCase();
        if (lowerText.includes("rent"))
            return "rental";
        if (lowerText.includes("buy") || lowerText.includes("purchase"))
            return "buying";
        if (lowerText.includes("student"))
            return "student";
        if (lowerText.includes("temporary") || lowerText.includes("short"))
            return "temporary";
        if (lowerText.includes("social"))
            return "social_housing";
        if (lowerText.includes("right") || lowerText.includes("law"))
            return "rights";
        return "general";
    }
    extractCity(text) {
        if (!text)
            return null;
        const majorCities = [
            "Paris",
            "Lyon",
            "Marseille",
            "Berlin",
            "Munich",
            "Frankfurt",
            "Hamburg",
            "Madrid",
            "Barcelona",
            "Amsterdam",
            "Rotterdam",
            "London",
            "Manchester",
            "Toronto",
            "Vancouver",
            "Montreal",
            "Sydney",
            "Melbourne",
            "New York",
            "Los Angeles",
            "Tokyo",
            "Singapore",
            "Dubai",
        ];
        for (const city of majorCities) {
            if (text.includes(city))
                return city;
        }
        return null;
    }
    extractRent(text) {
        if (!text)
            return null;
        const patterns = [
            /average\s+rent[:\s]+[€$£]?\s*[\d,]+/i,
            /[€$£]\s*[\d,]+\s*(?:per\s+)?(?:month|week)/i,
            /rent[:\s]+[€$£]?\s*[\d,]+\s*[-–]\s*[€$£]?\s*[\d,]+/i,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match)
                return match[0];
        }
        return null;
    }
    extractDocuments($section, _$) {
        const documents = [];
        const documentKeywords = [
            "passport",
            "id",
            "proof of income",
            "bank statement",
            "employment contract",
            "references",
            "deposit",
            "guarantor",
            "visa",
        ];
        const text = $section.text().toLowerCase();
        for (const doc of documentKeywords) {
            if (text.includes(doc)) {
                documents.push(doc);
            }
        }
        return documents.length > 0 ? JSON.stringify(documents) : null;
    }
    extractPlatforms($section, $) {
        const platforms = [];
        $section.find("a").each((_, el) => {
            const href = $(el).attr("href");
            const text = extractText($(el));
            if (href && this.isHousingRelated(text || href)) {
                platforms.push({ name: text, url: href });
            }
        });
        return platforms.length > 0 ? JSON.stringify(platforms) : null;
    }
    saveHousingInfo(db, item) {
        const stmt = db.prepare(`
      INSERT INTO housing_info (
        country_code, city, category, title, description,
        average_rent, required_documents, tips, rental_platforms,
        source_url, source_name, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(item.country_code, item.city, item.category, item.title, item.description, item.average_rent, item.required_documents, item.tips, item.rental_platforms, item.source_url, item.source_name, item.language);
    }
}
export async function scrapeHousingForCountry(countryCode) {
    const scraper = new HousingScraper();
    return scraper.scrapeCountry(countryCode);
}
export async function scrapeAllHousingInfo() {
    const db = getDb();
    const countries = db
        .prepare("SELECT code FROM countries")
        .all();
    const scraper = new HousingScraper();
    const results = [];
    for (const country of countries) {
        try {
            const data = await scraper.scrapeCountry(country.code);
            results.push({ country: country.code, count: data.length });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to scrape housing info for ${country.code}: ${message}`);
        }
    }
    return results;
}
//# sourceMappingURL=housing-scraper.js.map
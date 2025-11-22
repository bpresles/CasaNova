# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CasaNova API is the backend for an international mobility platform, aggregating visa, job market, housing, healthcare, and banking information for expats and immigrants.

**Current Status:** Active development (Startup Weekend context - 48h sprints)

## Tech Stack

- Node.js 22+ with ES modules (`"type": "module"`)
- NestJS framework with TypeScript
- SQLite (better-sqlite3) for data storage
- Cheerio + Axios for web scraping
- tsx for development (hot reload)

## Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload (port 3000)
npm start            # Start production server
npm run typecheck    # TypeScript type checking
npm run build        # Compile TypeScript to dist/

# Scraping commands
npm run scrape           # Scrape all data sources
npm run scrape:visa      # Scrape visa info only
npm run scrape:job       # Scrape job info only
npm run scrape:housing   # Scrape housing info only
```

## Architecture

```
src/
├── main.ts                 # NestJS bootstrap entry point
├── app.module.ts           # Root module importing all feature modules
├── app.controller.ts       # Root controller (/, /health)
├── modules/                # Feature modules (NestJS pattern)
│   ├── database/           # Global DatabaseService (SQLite)
│   ├── visa/               # Visa info endpoints + scraping
│   ├── job/                # Job market endpoints + scraping
│   ├── housing/            # Housing endpoints + scraping
│   ├── healthcare/         # Healthcare endpoints + scraping
│   ├── banking/            # Banking endpoints + scraping
│   └── countries/          # Countries list and summaries
├── scrapers/               # Base scraper utilities (fetchPage, extractText, etc.)
├── sources/                # JSON files with scraping source URLs by country
├── scripts/                # CLI scraping scripts
└── types/                  # Shared TypeScript interfaces
```

### Module Structure

Each domain module follows NestJS conventions:
- `*.module.ts` - Module definition with imports/exports
- `*.service.ts` - Business logic + scraping methods
- `*.controller.ts` - REST endpoints

### Database

SQLite database at `data/casanova.db` with tables:
- `countries` - Supported countries (seeded on init)
- `visa_info`, `job_info`, `housing_info`, `healthcare_info`, `banking_info` - Domain data
- `scrape_logs` - Scraping history

The DatabaseService is a global singleton that initializes the schema on app start.

### Scraping

Source URLs are defined in JSON files under `src/sources/` (one per domain). Each service has a `scrapeCountry(countryCode)` method that:
1. Fetches pages using `fetchPage()` from base-scraper
2. Parses content with Cheerio
3. Saves extracted data to SQLite
4. Logs scrape results

The base scraper includes robots.txt checking and rate limiting (2s between requests to same domain).

## API Endpoints

| Prefix | Description |
|--------|-------------|
| `/visa/*` | Visa requirements and procedures |
| `/job/*` | Job market information |
| `/housing/*` | Housing/rental information |
| `/healthcare/*` | Healthcare system, emergency numbers |
| `/banking/*` | Banking and financial services |
| `/countries/*` | Countries list and summaries |

Each domain supports: GET list, GET by country, POST scrape trigger.

## Development Notes

- All imports use `.js` extension (ESM requirement)
- Decorators enabled for NestJS (`experimentalDecorators`, `emitDecoratorMetadata`)
- JSON fields (arrays/objects) are stored as JSON strings and parsed on read
- Keep it simple - this is a startup weekend prototype, not production code

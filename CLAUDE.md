# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CasaNova is a startup project aimed at facilitating international mobility (professional or personal) by connecting people with services, support, healthcare professionals, and community resources that relate to their cultural background and country of origin, with support in their native language.

**Current Status:** Active development (Startup Weekend context - 48h sprints)

## API Backend

The project includes a NestJS API backend (TypeScript) for aggregating international mobility information.

### Tech Stack
- Node.js 22+ with ES modules
- NestJS framework with TypeScript
- SQLite (better-sqlite3) for data storage
- Cheerio + Axios for web scraping

### Common Commands

```bash
cd api
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload (port 3000)
npm start            # Start production server
npm run typecheck    # TypeScript type checking
npm run scrape       # Scrape all data sources
npm run scrape:visa  # Scrape visa info only
npm run scrape:job   # Scrape job info only
npm run scrape:housing # Scrape housing info only
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/visa/*` | Visa requirements and procedures by country |
| `/job/*` | Job market information for foreigners |
| `/housing/*` | Housing/rental information for foreigners |
| `/healthcare/*` | Healthcare system information |
| `/banking/*` | Banking and financial services for expats |
| `/countries/*` | List of supported countries and summaries |

### Architecture

```
api/
├── src/
│   ├── main.ts            # NestJS bootstrap entry point
│   ├── app.module.ts      # Root module
│   ├── modules/           # Feature modules (visa, job, housing, etc.)
│   ├── scrapers/          # Web scraping utilities
│   ├── sources/           # JSON files with scraping URLs
│   └── scripts/           # CLI scraping scripts
└── data/                  # SQLite database (gitignored)
```

## Project Language

Documentation is in French. When contributing, maintain French for user-facing content and documentation unless otherwise specified.

## AI-Assisted Development Guidelines

From the project's GenAI notes:

- **Verify AI outputs** - Never take AI-generated data at face value; always verify sources
- **Maintain empathy** - Keep the target users in focus and don't sacrifice empathy for technical solutions
- **Keep it simple** - Avoid over-complicating the concept
- **Startup context** - Responses should account for the 48-hour startup weekend constraint
- **Prototype focus** - Use AI for rapid prototyping ("vibe coding") rather than production-grade code

## Key Pitfalls to Avoid

- Ignoring personal preferences/context of target users
- Sacrificing empathy in solutions
- Losing sight of the target audience
- Over-engineering or over-complicating
- Building for hypothetical future requirements instead of immediate validation needs

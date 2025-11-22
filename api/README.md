# CasaNova API

Backend API for CasaNova - an international mobility information aggregator that helps expats and immigrants access visa, job market, housing, healthcare, and banking information for their destination countries.

## Features

- **Visa Information** - Requirements, processing times, costs, and procedures
- **Job Market** - Work permits, popular sectors, job portals, and salary info
- **Housing** - Rental markets, required documents, and platforms by city
- **Healthcare** - Public health systems, insurance requirements, emergency numbers
- **Banking** - Account opening requirements, recommended banks, tips
- **Multi-country support** - 20+ countries across Europe, Americas, Asia, and Oceania

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) with TypeScript
- **Database**: SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Web Scraping**: [Cheerio](https://cheerio.js.org/) + [Axios](https://axios-http.com/)
- **Runtime**: Node.js 22+

## Getting Started

### Prerequisites

- Node.js 22 or higher
- npm

### Installation

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# The API will be available at http://localhost:3000
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm start` | Start production server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run scrape` | Scrape all data sources |
| `npm run scrape:visa` | Scrape visa information only |
| `npm run scrape:job` | Scrape job market info only |
| `npm run scrape:housing` | Scrape housing info only |

## API Endpoints

### Root

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info and available endpoints |
| GET | `/health` | Health check |

### Visa (`/visa`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/visa` | List all visa info (filters: `country`, `type`, `language`) |
| GET | `/visa/countries` | List countries with visa data |
| GET | `/visa/types` | List visa types |
| GET | `/visa/:countryCode` | Get visa info for a country |
| GET | `/visa/:countryCode/:visaType` | Get specific visa type info |
| POST | `/visa/scrape/:countryCode` | Trigger scraping for a country |

### Job Market (`/job`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/job` | List all job info (filters: `country`, `category`, `language`) |
| GET | `/job/countries` | List countries with job data |
| GET | `/job/categories` | List job categories |
| GET | `/job/sectors` | List popular sectors |
| GET | `/job/:countryCode` | Get job info for a country |
| POST | `/job/scrape/:countryCode` | Trigger scraping for a country |

### Housing (`/housing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/housing` | List all housing info (filters: `country`, `city`, `category`) |
| GET | `/housing/countries` | List countries with housing data |
| GET | `/housing/cities` | List cities with housing data |
| GET | `/housing/categories` | List housing categories |
| GET | `/housing/:countryCode` | Get housing info for a country |
| GET | `/housing/:countryCode/:city` | Get housing info for a city |
| POST | `/housing/scrape/:countryCode` | Trigger scraping for a country |

### Healthcare (`/healthcare`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/healthcare` | List all healthcare info |
| GET | `/healthcare/countries` | List countries with healthcare data |
| GET | `/healthcare/emergency/:countryCode` | Get emergency numbers |
| GET | `/healthcare/:countryCode` | Get healthcare info for a country |
| POST | `/healthcare/scrape/:countryCode` | Trigger scraping for a country |

### Banking (`/banking`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/banking` | List all banking info |
| GET | `/banking/countries` | List countries with banking data |
| GET | `/banking/categories` | List banking categories |
| GET | `/banking/:countryCode` | Get banking info for a country |
| POST | `/banking/scrape/:countryCode` | Trigger scraping for a country |

### Countries (`/countries`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/countries` | List all supported countries (filter: `region`) |
| GET | `/countries/regions` | List regions |
| GET | `/countries/:code` | Get country details with available info counts |
| GET | `/countries/:code/summary` | Get summary of all info for a country |

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root NestJS module
├── app.controller.ts       # Root controller
├── modules/
│   ├── database/           # Database service (SQLite)
│   ├── visa/               # Visa module
│   ├── job/                # Job market module
│   ├── housing/            # Housing module
│   ├── healthcare/         # Healthcare module
│   ├── banking/            # Banking module
│   └── countries/          # Countries module
├── scrapers/               # Web scraping utilities
├── sources/                # JSON files with source URLs
├── scripts/                # CLI scraping scripts
└── types/                  # TypeScript interfaces
```

## Supported Countries

Europe, North America, Oceania, Asia, Middle East, South America, and Africa - including France, Germany, Spain, UK, USA, Canada, Australia, Japan, UAE, Brazil, Morocco, and more.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

## License

Private - CasaNova Project

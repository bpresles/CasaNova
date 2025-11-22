import type { CheerioAPI } from "cheerio";
export type { CheerioAPI };
export interface Source {
    name: string;
    url: string;
    type: string;
}
export type SourceMap = Record<string, Source[]>;
export interface FetchResult {
    html: string;
    $: CheerioAPI;
    status: number;
    url: string;
}
export interface FetchOptions {
    language?: string;
    headers?: Record<string, string>;
    timeout?: number;
}
export interface ExtractedLink {
    url: string;
    text: string | null;
}
export interface VisaInfo {
    country_code: string;
    visa_type: string;
    title: string;
    description: string | null;
    requirements: string | null;
    processing_time: string | null;
    cost: string | null;
    validity: string | null;
    source_url: string;
    source_name: string;
    language: string;
}
export interface JobInfo {
    country_code: string;
    category: string;
    title: string;
    description: string | null;
    work_permit_required: boolean | null;
    average_salary: string | null;
    job_search_tips: string | null;
    popular_sectors: string | null;
    job_portals: string | null;
    source_url: string;
    source_name: string;
    language: string;
}
export interface JobPortal {
    name: string | null;
    url: string;
}
export interface HousingInfo {
    country_code: string;
    city: string | null;
    category: string;
    title: string;
    description: string | null;
    average_rent: string | null;
    required_documents: string | null;
    tips: string | null;
    rental_platforms: string | null;
    source_url: string;
    source_name: string;
    language: string;
}
export interface RentalPlatform {
    name: string | null;
    url: string;
}
export interface HealthcareInfo {
    country_code: string;
    category: string;
    title: string;
    description: string | null;
    public_system_info: string | null;
    insurance_requirements: string | null;
    emergency_numbers: string | null;
    useful_links: string | null;
    source_url: string;
    source_name: string;
    language: string;
}
export interface EmergencyNumbers {
    emergency?: string;
    police?: string;
    fire?: string;
    samu?: string;
    nhs?: string;
    carabinieri?: string;
}
export interface UsefulLink {
    name: string | null;
    url: string;
}
export interface BankingInfo {
    country_code: string;
    category: string;
    title: string;
    description: string | null;
    account_requirements: string | null;
    recommended_banks: string | null;
    tips: string | null;
    source_url: string;
    source_name: string;
    language: string;
}
export interface Country {
    id?: number;
    code: string;
    name: string;
    name_fr: string | null;
    region: string | null;
    created_at?: string;
    updated_at?: string;
}
export interface ScrapeResult {
    country: string;
    count: number;
}
export interface CountryRow {
    id: number;
    code: string;
    name: string;
    name_fr: string | null;
    region: string | null;
}
//# sourceMappingURL=index.d.ts.map
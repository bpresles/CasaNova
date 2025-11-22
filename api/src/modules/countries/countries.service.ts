import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Country } from "../../entities/country.entity.js";
import { VisaInfo } from "../../entities/visa-info.entity.js";
import { JobInfo } from "../../entities/job-info.entity.js";
import { HousingInfo } from "../../entities/housing-info.entity.js";
import { HealthcareInfo } from "../../entities/healthcare-info.entity.js";
import { BankingInfo } from "../../entities/banking-info.entity.js";

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @InjectRepository(VisaInfo)
    private visaInfoRepository: Repository<VisaInfo>,
    @InjectRepository(JobInfo)
    private jobInfoRepository: Repository<JobInfo>,
    @InjectRepository(HousingInfo)
    private housingInfoRepository: Repository<HousingInfo>,
    @InjectRepository(HealthcareInfo)
    private healthcareInfoRepository: Repository<HealthcareInfo>,
    @InjectRepository(BankingInfo)
    private bankingInfoRepository: Repository<BankingInfo>,
  ) {}

  async findAll(region?: string) {
    const queryBuilder = this.countryRepository.createQueryBuilder("country");

    if (region) {
      queryBuilder.where("country.region = :region", { region });
    }

    queryBuilder.orderBy("country.name", "ASC");
    return await queryBuilder.getMany();
  }

  async findRegions() {
    const results = await this.countryRepository
      .createQueryBuilder("country")
      .select("country.region", "region")
      .addSelect("COUNT(*)", "country_count")
      .where("country.region IS NOT NULL")
      .groupBy("country.region")
      .orderBy("country.region", "ASC")
      .getRawMany();

    return results;
  }

  async findByCode(code: string) {
    const countryCode = code.toUpperCase();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode },
    });

    if (!country) return null;

    const visaCount = await this.visaInfoRepository.count({
      where: { country_code: countryCode },
    });

    const jobCount = await this.jobInfoRepository.count({
      where: { country_code: countryCode },
    });

    const housingCount = await this.housingInfoRepository.count({
      where: { country_code: countryCode },
    });

    const healthcareCount = await this.healthcareInfoRepository.count({
      where: { country_code: countryCode },
    });

    const bankingCount = await this.bankingInfoRepository.count({
      where: { country_code: countryCode },
    });

    return {
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
    };
  }

  async findSummary(code: string) {
    const countryCode = code.toUpperCase();

    const country = await this.countryRepository.findOne({
      where: { code: countryCode },
    });

    if (!country) return null;

    const latestVisa = await this.visaInfoRepository.find({
      where: { country_code: countryCode },
      select: ["title", "visa_type", "description"],
      order: { updated_at: "DESC" },
      take: 3,
    });

    const latestJob = await this.jobInfoRepository.find({
      where: { country_code: countryCode },
      select: ["title", "category", "description"],
      order: { updated_at: "DESC" },
      take: 3,
    });

    const latestHousing = await this.housingInfoRepository.find({
      where: { country_code: countryCode },
      select: ["title", "category", "city", "description"],
      order: { updated_at: "DESC" },
      take: 3,
    });

    const latestHealthcare = await this.healthcareInfoRepository.find({
      where: { country_code: countryCode },
      select: ["title", "category", "emergency_numbers"],
      order: { updated_at: "DESC" },
      take: 3,
    });

    const latestBanking = await this.bankingInfoRepository.find({
      where: { country_code: countryCode },
      select: ["title", "category", "description"],
      order: { updated_at: "DESC" },
      take: 3,
    });

    return {
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
    };
  }
}

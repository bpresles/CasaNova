import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ScrapeLog } from "../../entities/scrape-log.entity.js";

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(
    @InjectRepository(ScrapeLog)
    private scrapeLogRepository: Repository<ScrapeLog>
  ) {}

  async onModuleInit() {
    // Database ready
  }

  async logScrape(sourceName: string, sourceUrl: string, status: string, itemsScraped: number = 0, errorMessage: string | null = null): Promise<void> {
    const log = this.scrapeLogRepository.create({
      source_name: sourceName,
      source_url: sourceUrl,
      status,
      items_scraped: itemsScraped,
      error_message: errorMessage,
      completed_at: new Date(),
    });

    await this.scrapeLogRepository.save(log);
  }
}

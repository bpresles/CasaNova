import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseService } from "./database.service.js";
import { ScrapeLog } from "../../entities/scrape-log.entity.js";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ScrapeLog]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}

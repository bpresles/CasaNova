import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BankingController } from "./banking.controller.js";
import { BankingService } from "./banking.service.js";
import { BankingInfo } from "../../entities/banking-info.entity.js";
import { Country } from "../../entities/country.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([BankingInfo, Country])],
  controllers: [BankingController],
  providers: [BankingService],
  exports: [BankingService],
})
export class BankingModule {}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HousingController } from "./housing.controller.js";
import { HousingService } from "./housing.service.js";
import { HousingInfo } from "../../entities/housing-info.entity.js";
import { Country } from "../../entities/country.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([HousingInfo, Country])],
  controllers: [HousingController],
  providers: [HousingService],
  exports: [HousingService],
})
export class HousingModule {}

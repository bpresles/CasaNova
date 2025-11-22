import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Country } from "../../entities/country.entity.js";
import { VisaInfo } from "../../entities/visa-info.entity.js";
import { VisaController } from "./visa.controller.js";
import { VisaService } from "./visa.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([VisaInfo, Country])],
  controllers: [VisaController],
  providers: [VisaService],
  exports: [VisaService],
})
export class VisaModule {}

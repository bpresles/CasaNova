import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VisaController } from "./visa.controller.js";
import { VisaService } from "./visa.service.js";
import { VisaInfo, Country } from "../../entities/index.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([VisaInfo, Country]),
  ],
  controllers: [VisaController],
  providers: [VisaService],
  exports: [VisaService],
})
export class VisaModule {}

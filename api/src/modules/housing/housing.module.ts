import { Module } from "@nestjs/common";
import { HousingController } from "./housing.controller.js";
import { HousingService } from "./housing.service.js";

@Module({
  controllers: [HousingController],
  providers: [HousingService],
  exports: [HousingService],
})
export class HousingModule {}

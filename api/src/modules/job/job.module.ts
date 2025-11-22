import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JobController } from "./job.controller.js";
import { JobService } from "./job.service.js";
import { JobInfo } from "../../entities/job-info.entity.js";
import { Country } from "../../entities/country.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([JobInfo, Country])],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { VisaInfo } from "./visa-info.entity.js";
import { JobInfo } from "./job-info.entity.js";
import { HousingInfo } from "./housing-info.entity.js";
import { HealthcareInfo } from "./healthcare-info.entity.js";
import { BankingInfo } from "./banking-info.entity.js";

@Entity("countries")
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", unique: true })
  code: string;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", nullable: true })
  name_fr: string | null;

  @Column({ type: "text", nullable: true })
  region: string | null;

  @CreateDateColumn({ type: "datetime" })
  created_at: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  @OneToMany(() => VisaInfo, (visa) => visa.country)
  visas: VisaInfo[];

  @OneToMany(() => JobInfo, (job) => job.country)
  jobs: JobInfo[];

  @OneToMany(() => HousingInfo, (housing) => housing.country)
  housing: HousingInfo[];

  @OneToMany(() => HealthcareInfo, (healthcare) => healthcare.country)
  healthcare: HealthcareInfo[];

  @OneToMany(() => BankingInfo, (banking) => banking.country)
  banking: BankingInfo[];
}

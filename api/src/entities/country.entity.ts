import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";

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

  @OneToMany("VisaInfo", "country")
  visas: any[];

  @OneToMany("JobInfo", "country")
  jobs: any[];

  @OneToMany("HousingInfo", "country")
  housing: any[];

  @OneToMany("HealthcareInfo", "country")
  healthcare: any[];

  @OneToMany("BankingInfo", "country")
  banking: any[];
}

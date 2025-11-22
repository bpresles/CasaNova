import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Country } from "./country.entity.js";

@Entity("job_info")
export class JobInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  country_code: string;

  @Column({ type: "text", nullable: true })
  category: string | null;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "boolean", nullable: true })
  work_permit_required: boolean | null;

  @Column({ type: "text", nullable: true })
  average_salary: string | null;

  @Column({ type: "text", nullable: true })
  job_search_tips: string | null;

  @Column({ type: "text", nullable: true })
  popular_sectors: string | null;

  @Column({ type: "text", nullable: true })
  job_portals: string | null;

  @Column({ type: "text", nullable: true })
  source_url: string | null;

  @Column({ type: "text", nullable: true })
  source_name: string | null;

  @Column({ type: "text", default: "en" })
  language: string;

  @CreateDateColumn({ type: "datetime" })
  created_at: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  @ManyToOne(() => Country, (country) => country.jobs)
  @JoinColumn({ name: "country_code", referencedColumnName: "code" })
  country: Country;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Country } from "./country.entity.js";

@Entity("healthcare_info")
export class HealthcareInfo {
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

  @Column({ type: "text", nullable: true })
  public_system_info: string | null;

  @Column({ type: "text", nullable: true })
  insurance_requirements: string | null;

  @Column({ type: "text", nullable: true })
  emergency_numbers: string | null;

  @Column({ type: "text", nullable: true })
  useful_links: string | null;

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

  @ManyToOne(() => Country, (country) => country.healthcare)
  @JoinColumn({ name: "country_code", referencedColumnName: "code" })
  country: Country;
}

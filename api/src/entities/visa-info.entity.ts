import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Country } from "./country.entity.js";

@Entity("visa_info")
export class VisaInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  country_code: string;

  @Column({ type: "text" })
  visa_type: string;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", nullable: true })
  requirements: string | null;

  @Column({ type: "text", nullable: true })
  processing_time: string | null;

  @Column({ type: "text", nullable: true })
  cost: string | null;

  @Column({ type: "text", nullable: true })
  validity: string | null;

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

  @ManyToOne(() => Country, (country) => country.visas)
  @JoinColumn({ name: "country_code", referencedColumnName: "code" })
  country: Country;
}

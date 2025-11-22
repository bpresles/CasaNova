import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Country } from "./country.entity.js";

@Entity("banking_info")
export class BankingInfo {
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
  account_requirements: string | null;

  @Column({ type: "text", nullable: true })
  recommended_banks: string | null;

  @Column({ type: "text", nullable: true })
  tips: string | null;

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

  @ManyToOne(() => Country, (country) => country.banking)
  @JoinColumn({ name: "country_code", referencedColumnName: "code" })
  country: Country;
}

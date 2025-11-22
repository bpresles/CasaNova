import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Country } from "./country.entity.js";

@Entity("housing_info")
export class HousingInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  country_code: string;

  @Column({ type: "text", nullable: true })
  city: string | null;

  @Column({ type: "text", nullable: true })
  category: string | null;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", nullable: true })
  average_rent: string | null;

  @Column({ type: "text", nullable: true })
  required_documents: string | null;

  @Column({ type: "text", nullable: true })
  tips: string | null;

  @Column({ type: "text", nullable: true })
  rental_platforms: string | null;

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

  @ManyToOne(() => Country, (country) => country.housing)
  @JoinColumn({ name: "country_code", referencedColumnName: "code" })
  country: Country;
}

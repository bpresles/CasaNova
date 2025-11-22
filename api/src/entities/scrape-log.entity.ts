import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("scrape_logs")
export class ScrapeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  source_name: string;

  @Column({ type: "text" })
  source_url: string;

  @Column({ type: "text" })
  status: string;

  @Column({ type: "integer", default: 0 })
  items_scraped: number;

  @Column({ type: "text", nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: "datetime" })
  started_at: Date;

  @Column({ type: "datetime", nullable: true })
  completed_at: Date | null;
}

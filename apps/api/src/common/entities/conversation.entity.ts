import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "conversations" })
export class ConversationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 20 })
  @Index("idx_conversations_kind")
  kind!: "dm" | "group" | "channel";

  @Column({ type: "varchar", length: 120, nullable: true })
  title!: string | null;

  @Column({ type: "timestamp", nullable: true })
  @Index("idx_conversations_last_message_at")
  lastMessageAt!: Date | null;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;
}

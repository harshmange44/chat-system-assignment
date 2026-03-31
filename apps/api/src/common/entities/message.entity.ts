import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "messages" })
@Index("idx_messages_conversation_created_at", ["conversationId", "createdAt"])
export class MessageEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  @Index("idx_messages_conversation_id")
  conversationId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 120 })
  userName!: string;

  @Column({ type: "text" })
  content!: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;
}

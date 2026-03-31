import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "conversation_members" })
@Index("idx_conversation_members_user_id", ["userId"])
export class ConversationMemberEntity {
  @PrimaryColumn({ type: "uuid" })
  conversationId!: string;

  @PrimaryColumn({ type: "uuid" })
  userId!: string;
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { GENERAL_CONVERSATION_ID } from "@chat-system/shared-types";
import { Repository } from "typeorm";
import { ConversationEntity } from "../common/entities/conversation.entity";

/**
 * Ensures the shared "General" channel row exists. Migrations normally insert it, but
 * partial runs / sync-only DBs can omit it, which breaks `messages.conversationId` FK.
 */
@Injectable()
export class GeneralConversationSeedService implements OnModuleInit {
  private readonly logger = new Logger(GeneralConversationSeedService.name);

  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
  ) {}

  async onModuleInit() {
    const existing = await this.conversations.findOne({
      where: { id: GENERAL_CONVERSATION_ID },
    });
    if (existing) return;
    try {
      await this.conversations.insert({
        id: GENERAL_CONVERSATION_ID,
        kind: "channel",
        title: "General",
        lastMessageAt: null,
      });
      this.logger.log(`Seeded default conversation ${GENERAL_CONVERSATION_ID}`);
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "23505" || code === "SQLITE_CONSTRAINT") {
        return;
      }
      throw e;
    }
  }
}

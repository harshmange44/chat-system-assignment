import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MessageEntity } from "../common/entities/message.entity";
import { ConversationService } from "../conversation/conversation.service";

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    private readonly conversationService: ConversationService,
  ) {}

  async getConversationHistory(conversationId: string): Promise<MessageEntity[]> {
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: "DESC" },
      take: 200,
    });
    return messages.reverse();
  }

  async createMessage(input: {
    conversationId: string;
    userId: string;
    userName: string;
    content: string;
  }): Promise<MessageEntity> {
    const entity = this.messageRepository.create({
      conversationId: input.conversationId,
      userId: input.userId,
      userName: input.userName,
      content: input.content.trim(),
    });
    const saved = await this.messageRepository.save(entity);
    await this.conversationService.touchLastMessage(input.conversationId);
    return saved;
  }
}

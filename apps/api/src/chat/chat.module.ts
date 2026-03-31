import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConversationMemberEntity } from "../common/entities/conversation-member.entity";
import { ConversationEntity } from "../common/entities/conversation.entity";
import { MessageEntity } from "../common/entities/message.entity";
import { ConversationController } from "../conversation/conversation.controller";
import { ConversationService } from "../conversation/conversation.service";
import { ProfileModule } from "../profile/profile.module";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { GeneralConversationSeedService } from "./general-conversation.seed";

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, ConversationEntity, ConversationMemberEntity]),
    ProfileModule,
  ],
  controllers: [ChatController, ConversationController],
  providers: [GeneralConversationSeedService, ChatGateway, ChatService, ConversationService],
  exports: [ChatService, ConversationService],
})
export class ChatModule {}

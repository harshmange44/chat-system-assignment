import { Controller, Get, Param } from "@nestjs/common";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("messages/:conversationId")
  async getMessages(@Param("conversationId") conversationId: string) {
    return this.chatService.getConversationHistory(conversationId);
  }
}

import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type RequestUser } from "../auth/jwt-auth.guard";
import { ConversationService } from "./conversation.service";
import { CreateDmDto } from "./dto/create-dm.dto";

@Controller("conversations")
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: { user: RequestUser }) {
    return this.conversationService.listSummariesForUser(req.user.id);
  }

  @Post("dm")
  @UseGuards(JwtAuthGuard)
  async createDm(@Req() req: { user: RequestUser }, @Body() body: CreateDmDto) {
    return this.conversationService.createDmResponse(req.user.id, body.peerUserId);
  }
}

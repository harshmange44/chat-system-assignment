import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { ClientUser } from "@chat-system/shared-types";
import { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import { ConversationService } from "../conversation/conversation.service";
import { ProfileService } from "../profile/profile.service";
import { ChatService } from "./chat.service";
import { JoinRoomDto, SendMessageDto, SetTypingDto } from "./dto/send-message.dto";

@WebSocketGateway({
  cors: { origin: "*" },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Track number of connected sockets per userId to handle multiple tabs
  private connectedUsers = new Map<string, number>();

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly conversationService: ConversationService,
    private readonly profileService: ProfileService,
  ) {}

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as Partial<ClientUser> | undefined;
    const accessToken =
      (client.handshake.auth as { accessToken?: string } | undefined)?.accessToken || undefined;
    const authRequired = process.env.AUTH_REQUIRED !== "false";

    const authed = this.authService.verifyAccessToken(accessToken);
    if (!authed && authRequired) {
      client.emit("auth:error", { message: "Invalid or missing access token" });
      client.disconnect(true);
      return;
    }

    if (authed) {
      const profile = await this.profileService.findById(authed.id);
      const userName = profile?.displayName ?? authed.userName;
      client.data.user = {
        userId: authed.id,
        userName,
      } as ClientUser;
      
      this.handleUserConnected(authed.id);
      client.emit("session:ready", { userId: authed.id });
      client.emit("online:sync", { userIds: Array.from(this.connectedUsers.keys()) });
      return;
    }

    const userId = auth?.userId ?? crypto.randomUUID();
    const userName = auth?.userName?.trim() || `User-${Math.floor(Math.random() * 1000)}`;
    client.data.user = { userId, userName } as ClientUser;
    
    this.handleUserConnected(userId);
    client.emit("session:ready", { userId });
    client.emit("online:sync", { userIds: Array.from(this.connectedUsers.keys()) });
  }

  async handleDisconnect(client: Socket) {
    const user = this.getUser(client);
    if (!user) return;
    
    const count = this.connectedUsers.get(user.userId) || 0;
    if (count <= 1) {
      this.connectedUsers.delete(user.userId);
      this.server.emit("user:offline", { userId: user.userId, isOnline: false });
    } else {
      this.connectedUsers.set(user.userId, count - 1);
    }
  }

  private handleUserConnected(userId: string) {
    const count = this.connectedUsers.get(userId) || 0;
    this.connectedUsers.set(userId, count + 1);
    // If it's their first tab connecting, broadcast online
    if (count === 0) {
      this.server.emit("user:online", { userId, isOnline: true });
    }
  }

  private getUser(client: Socket): ClientUser | null {
    const user = client.data.user as ClientUser | undefined;
    return user?.userId ? user : null;
  }

  @SubscribeMessage("room:join")
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinRoomDto) {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;

    const user = this.getUser(client);
    if (!user) {
      client.emit("room:error", { message: "Session not ready yet" });
      return;
    }
    const allowed = await this.conversationService.canAccess(user.userId, conversationId);
    if (!allowed) {
      client.emit("room:error", { message: "Cannot join this conversation" });
      return;
    }

    await client.join(conversationId);
    const history = await this.chatService.getConversationHistory(conversationId);
    client.emit("room:history", { conversationId, messages: history });
  }

  @SubscribeMessage("message:send")
  async onSend(@ConnectedSocket() client: Socket, @MessageBody() payload: SendMessageDto) {
    const conversationId = payload?.conversationId;
    const content = payload?.content?.trim();
    if (!conversationId || !content) return;

    const user = this.getUser(client);
    if (!user) return;

    const allowed = await this.conversationService.canAccess(user.userId, conversationId);
    if (!allowed) return;

    const message = await this.chatService.createMessage({
      conversationId,
      userId: user.userId,
      userName: user.userName,
      content,
    });
    this.server.to(conversationId).emit("message:new", message);
  }

  @SubscribeMessage("typing:set")
  async onTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: SetTypingDto) {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;

    const user = this.getUser(client);
    if (!user) return;

    const allowed = await this.conversationService.canAccess(user.userId, conversationId);
    if (!allowed) return;

    client.to(conversationId).emit("typing:update", {
      conversationId,
      userId: user.userId,
      userName: user.userName,
      isTyping: payload?.isTyping ?? false,
    });
  }
}

import { IsBoolean, IsNotEmpty, IsString, IsUUID, MaxLength } from "class-validator";

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class SetTypingDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId!: string;

  @IsBoolean()
  isTyping!: boolean;
}

export class JoinRoomDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId!: string;
}

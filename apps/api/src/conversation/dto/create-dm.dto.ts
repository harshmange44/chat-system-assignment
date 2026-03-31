import { IsNotEmpty, IsUUID } from "class-validator";

export class CreateDmDto {
  @IsUUID()
  @IsNotEmpty()
  peerUserId!: string;
}

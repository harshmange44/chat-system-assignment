import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class UpsertProfileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;
}

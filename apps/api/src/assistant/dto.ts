import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateThreadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;
}

export class PostMessageDto {
  @IsString()
  @MinLength(1)
  content!: string;
}

import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateScimTokenDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

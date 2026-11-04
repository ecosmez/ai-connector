import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertSsoConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsIn(["mock"])
  provider?: "mock";

  @IsOptional()
  @IsBoolean()
  jitProvisioning?: boolean;
}

export class MockAuthorizeDto {
  @IsString()
  @MinLength(3)
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

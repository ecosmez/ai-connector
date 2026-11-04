import { IsBoolean, IsIn, IsOptional } from "class-validator";

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

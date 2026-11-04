import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateSecurityPolicyDto {
  @IsBoolean()
  requireMfa!: boolean;
}

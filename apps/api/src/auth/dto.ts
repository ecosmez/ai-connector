import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class SwitchContextDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  companyId?: string | null;
}

import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateConnectionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class TriggerSyncDto {
  /** Optional; prefer Idempotency-Key header. */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateGoalDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  metricKey!: string;

  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @IsIn(["gte", "lte"])
  comparator?: "gte" | "lte";

  @IsOptional()
  @IsString()
  dashboardId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

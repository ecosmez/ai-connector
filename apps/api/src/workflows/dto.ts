import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

class WorkflowStepDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsIn(["check_goal", "notify", "wait_approval"])
  type!: "check_goal" | "notify" | "wait_approval";

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps!: WorkflowStepDto[];
}

export class StartWorkflowRunDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class UpdateWorkflowScheduleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  cron?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class DecideApprovalDto {
  @IsIn(["approved", "rejected"])
  decision!: "approved" | "rejected";

  @IsOptional()
  @IsString()
  note?: string;
}

import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { AssistantService } from "./assistant.service";
import { CreateThreadDto, PostMessageDto } from "./dto";

@Controller()
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get("assistant/status")
  status() {
    const provider = (process.env.AI_PROVIDER ?? "").toLowerCase();
    const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
    return {
      enabled:
        process.env.AI_ENABLED !== "0" && process.env.AI_ENABLED !== "false",
      mode: provider === "mock" || !hasKey ? "mock" : "openai",
    };
  }

  @Post("organizations/:orgId/assistant/threads")
  createThread(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateThreadDto,
  ) {
    return this.assistantService.createThread(
      auth.user.id,
      orgId,
      body.title,
      auth.session.activeCompanyId,
    );
  }

  @Get("organizations/:orgId/assistant/threads")
  listThreads(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    return this.assistantService.listThreads(
      auth.user.id,
      orgId,
      auth.session.activeCompanyId,
    );
  }

  @Get("organizations/:orgId/assistant/threads/:threadId")
  getThread(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("threadId") threadId: string,
  ) {
    return this.assistantService.getThread(
      auth.user.id,
      orgId,
      threadId,
      auth.session.activeCompanyId,
    );
  }

  @Post("organizations/:orgId/assistant/threads/:threadId/messages")
  postMessage(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("threadId") threadId: string,
    @Body() body: PostMessageDto,
  ) {
    return this.assistantService.postMessage(
      auth.user.id,
      orgId,
      threadId,
      body.content,
      auth.session.activeCompanyId,
    );
  }
}

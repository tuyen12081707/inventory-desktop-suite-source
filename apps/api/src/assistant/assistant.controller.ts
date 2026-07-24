import { Body, Controller, Post } from '@nestjs/common';
import {
  AiChatRequestSchema,
  type AiChatRequest,
  type AiChatResponse,
  type AuthUser,
} from '@inventory/contracts';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @RequirePermissions('assistant.use')
  @Post('chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AiChatRequestSchema)) input: AiChatRequest,
  ): Promise<AiChatResponse> {
    return this.assistantService.chat(user.companyId, input);
  }
}

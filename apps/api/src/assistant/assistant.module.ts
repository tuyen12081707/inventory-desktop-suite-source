import { Module } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { GeminiGatewayService } from './gemini-gateway.service';

@Module({
  controllers: [AssistantController],
  providers: [AiConfigService, AssistantService, GeminiGatewayService],
  exports: [AiConfigService, AssistantService],
})
export class AssistantModule {}

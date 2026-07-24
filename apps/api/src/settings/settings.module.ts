import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AssistantModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}

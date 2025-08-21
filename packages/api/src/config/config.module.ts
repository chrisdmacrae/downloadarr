import { Module } from '@nestjs/common';
import { GamePlatformsService } from './game-platforms.service';
import { GamePlatformsController } from './game-platforms.controller';
import { AppConfigurationService } from './services/app-configuration.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [GamePlatformsService, AppConfigurationService],
  controllers: [GamePlatformsController],
  exports: [GamePlatformsService, AppConfigurationService],
})
export class GameConfigModule {}

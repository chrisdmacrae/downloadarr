import { Module } from '@nestjs/common';
import { GamePlatformsService } from './game-platforms.service';
import { GamePlatformsController } from './game-platforms.controller';
import { AppConfigurationService } from './services/app-configuration.service';
import { AppConfigurationController } from './controllers/app-configuration.controller';
import { DatabaseModule } from '../database/database.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [DatabaseModule, OrganizationModule],
  providers: [GamePlatformsService, AppConfigurationService],
  controllers: [GamePlatformsController, AppConfigurationController],
  exports: [GamePlatformsService, AppConfigurationService],
})
export class GameConfigModule {}

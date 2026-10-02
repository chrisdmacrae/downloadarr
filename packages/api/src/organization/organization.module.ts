import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { TorrentsModule } from '../torrents/torrents.module';
import { DownloadModule } from '../download/download.module';

// Services
import { OrganizationRulesService } from './services/organization-rules.service';
import { FileOrganizationService } from './services/file-organization.service';
import { ReverseIndexingService } from './services/reverse-indexing.service';
import { DownloadOrganizationService } from './services/download-organization.service';
import { DownloadsFolderService } from './services/downloads-folder.service';
import { AppConfigurationService } from '../config/services/app-configuration.service';

// Controllers
import { OrganizationController } from './controllers/organization.controller';
import { AppConfigurationController } from '../config/controllers/app-configuration.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    DiscoveryModule,
    forwardRef(() => TorrentsModule),
    forwardRef(() => DownloadModule),
  ],
  providers: [
    OrganizationRulesService,
    FileOrganizationService,
    DownloadOrganizationService,
    DownloadsFolderService,
    ReverseIndexingService,
    AppConfigurationService,
  ],
  controllers: [
    OrganizationController,
    AppConfigurationController,
  ],
  exports: [
    OrganizationRulesService,
    FileOrganizationService,
    DownloadOrganizationService,
    ReverseIndexingService,
  ],
})
export class OrganizationModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';

// Services
import { OrganizationRulesService } from './services/organization-rules.service';
import { FileOrganizationService } from './services/file-organization.service';
import { ReverseIndexingService } from './services/reverse-indexing.service';

// Controllers
import { OrganizationController } from './controllers/organization.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
  providers: [
    OrganizationRulesService,
    FileOrganizationService,
    ReverseIndexingService,
  ],
  controllers: [
    OrganizationController,
  ],
  exports: [
    OrganizationRulesService,
    FileOrganizationService,
    ReverseIndexingService,
  ],
})
export class OrganizationModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ProwlarrConfigService } from './prowlarr-config.service';
import { ProwlarrController } from './prowlarr.controller';
import { GameConfigModule } from '../config/config.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
    GameConfigModule,
  ],
  providers: [ProwlarrConfigService],
  controllers: [ProwlarrController],
  exports: [ProwlarrConfigService],
})
export class ProwlarrModule {}

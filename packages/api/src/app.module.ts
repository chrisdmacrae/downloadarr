import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DownloadModule } from './download/download.module';
import { VpnModule } from './vpn/vpn.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { TorrentsModule } from './torrents/torrents.module';
import { GameConfigModule } from './config/config.module';
import { JackettModule } from './jackett/jackett.module';
import { OrganizationModule } from './organization/organization.module';
import { InitializationModule } from './initialization/initialization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    InitializationModule,
    DatabaseModule,
    DownloadModule,
    VpnModule,
    DiscoveryModule,
    TorrentsModule,
    GameConfigModule,
    JackettModule,
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

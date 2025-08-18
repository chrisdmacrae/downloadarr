import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DownloadModule } from './download/download.module';
import { VpnModule } from './vpn/vpn.module';
import { DiscoveryModule } from './discovery/discovery.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    DownloadModule,
    VpnModule,
    DiscoveryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

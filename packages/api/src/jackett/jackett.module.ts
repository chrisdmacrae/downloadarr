import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JackettConfigService } from './jackett-config.service';
import { JackettController } from './jackett.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [JackettConfigService],
  controllers: [JackettController],
  exports: [JackettConfigService],
})
export class JackettModule {}

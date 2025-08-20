import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InitializationService } from './initialization.service';

@Module({
  imports: [ConfigModule],
  providers: [InitializationService],
  exports: [InitializationService],
})
export class InitializationModule {}

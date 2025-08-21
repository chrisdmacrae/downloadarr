import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';

@Module({
  imports: [HttpModule],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}

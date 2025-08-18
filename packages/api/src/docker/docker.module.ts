import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DockerService } from './docker.service';

@Module({
  imports: [HttpModule],
  providers: [DockerService],
  exports: [DockerService],
})
export class DockerModule {}

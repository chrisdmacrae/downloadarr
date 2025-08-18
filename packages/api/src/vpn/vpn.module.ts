import { Module } from '@nestjs/common';
import { VpnService } from './vpn.service';
import { VpnController } from './vpn.controller';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [DockerModule],
  controllers: [VpnController],
  providers: [VpnService],
  exports: [VpnService],
})
export class VpnModule {}

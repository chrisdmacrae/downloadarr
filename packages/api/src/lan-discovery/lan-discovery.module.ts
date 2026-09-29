import { Module } from '@nestjs/common';
import { LanDiscoveryService } from './lan-discovery.service';

@Module({
  providers: [LanDiscoveryService],
})
export class LanDiscoveryModule {}

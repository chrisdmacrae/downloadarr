import { Module } from '@nestjs/common';
import { VpnService } from './vpn.service';
import { VpnController } from './vpn.controller';

@Module({
  controllers: [VpnController],
  providers: [VpnService],
  exports: [VpnService],
})
export class VpnModule {}

import { Module } from '@nestjs/common';
import { GamePlatformsService } from './game-platforms.service';
import { GamePlatformsController } from './game-platforms.controller';

@Module({
  providers: [GamePlatformsService],
  controllers: [GamePlatformsController],
  exports: [GamePlatformsService],
})
export class GameConfigModule {}

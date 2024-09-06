import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MediasoupModule } from './mediasoup/mediasoup.module';
import { AppController } from './app.controller';
import appConfig from './app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    EventEmitterModule.forRoot({
      global: true,
    }),
    ScheduleModule.forRoot(),
    MediasoupModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

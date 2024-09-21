import {
  Logger,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { version } from 'mediasoup';
import { MediasoupService } from './mediasoup.service';
import { MediasoupController } from './mediasoup.controller';
import mediasoupConfig from './mediasoup.config';

@Module({
  imports: [ConfigModule.forFeature(mediasoupConfig)],
  controllers: [MediasoupController],
  providers: [
    MediasoupService,
    {
      provide: 'RESOURCE',
      useValue: {
        workers: [],
        routers: [],
        consumers: [],
        producers: [],
        transports: [],
        dataConsumers: [],
        dataProducers: [],
        audioLevelObserver: [],
        activeSpeakerObserver: [],
        currentWorker: 0,
      },
    },
  ],
  exports: [MediasoupService],
})
export class MediasoupModule
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MediasoupModule.name);
  constructor(private readonly mediasoupService: MediasoupService) {}

  async onApplicationBootstrap() {
    this.logger.log(`Mediasoup version ${version}`);
    const { workerCount, workerLogLevel, workerLogTags } =
      this.mediasoupService.config();

    for (let i = 1; i <= workerCount; i = i + 1) {
      const worker = await this.mediasoupService.createWorker({
        logLevel: workerLogLevel,
        logTags: workerLogTags,
      });

      if (!worker.closed) {
        this.logger.log(`Worker opened [PID]: ${worker.pid}`);
      }
    }
  }

  onApplicationShutdown() {
    const workers = this.mediasoupService.getWorkers();
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i];
      worker.close();

      if (worker.closed) {
        this.logger.log(`Worker closed [PID]: ${worker.pid}`);
      }
    }
  }
}

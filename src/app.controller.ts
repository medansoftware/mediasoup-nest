import os from 'node:os';
import { Controller, Get, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { version } from 'mediasoup';
import { WorkerEvent, WorkerEventName } from './mediasoup/mediasoup.type';

@Controller()
export class AppController {
  constructor(private readonly logger: Logger) {}

  @Get()
  getHello() {
    const cpus = os.cpus();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - freeMemory;

    return {
      timezone: process.env.TZ,
      mediasoup: version,
      CPU: cpus,
      RAM: {
        freeMemory,
        usedMemory,
        totalMemory,
      },
    };
  }

  @OnEvent(WorkerEventName.SubprocessClose)
  workerSubprocessClosed(payload: WorkerEvent) {
    this.logger.error('Worker subprocess closed', payload, AppController.name);
  }

  @OnEvent(WorkerEventName.Close)
  workerClosed(payload: WorkerEvent) {
    this.logger.error('Worker closed', payload, AppController.name);
  }
}

import os from 'node:os';
import { Controller, Get } from '@nestjs/common';
import { version } from 'mediasoup';

@Controller()
export class AppController {
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
}

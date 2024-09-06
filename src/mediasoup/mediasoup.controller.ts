import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { types } from 'mediasoup';
import {
  ConsumerCreateDto,
  ProducerCreateDto,
  TransportConnectDto,
  TransportCreateDto,
  WorkerCreateDto,
  WorkerUpdateDto,
} from './mediasoup.dto';
import {
  ConsumerAPIResponse,
  ProducerAPIResponse,
  RouterAPIResponse,
  TransportAPIResponse,
  WorkerAPIResponse,
} from './mediasoup.type';
import { MediasoupService } from './mediasoup.service';

@Controller('mediasoup')
export class MediasoupController {
  constructor(private readonly mediasoupService: MediasoupService) {}

  @Post('workers')
  async createWorker(
    @Body() body: WorkerCreateDto,
  ): Promise<WorkerAPIResponse> {
    const worker = await this.mediasoupService.createWorker(body);
    return {
      pid: worker.pid,
      appData: {
        count: worker.appData.count,
      },
      closed: worker.closed,
    };
  }

  @Get('workers')
  getWorkers(): WorkerAPIResponse[] {
    return this.mediasoupService.getWorkers().map((worker) => ({
      pid: worker.pid,
      appData: {
        count: worker.appData.count,
      },
      closed: worker.closed,
    }));
  }

  @Get('workers/:pid')
  getWorker(@Param('pid', ParseIntPipe) pid: number): WorkerAPIResponse {
    const worker = this.mediasoupService.getWorkerByPID(pid);
    return {
      pid: worker.pid,
      appData: {
        count: worker.appData.count,
      },
      closed: worker.closed,
    };
  }

  @Put('workers/:pid')
  async updateWorker(
    @Param('pid', ParseIntPipe) pid: number,
    @Body() body: WorkerUpdateDto,
  ): Promise<WorkerAPIResponse> {
    const worker = this.mediasoupService.getWorkerByPID(pid);
    await worker.updateSettings(body);
    return {
      pid: worker.pid,
      appData: {
        count: worker.appData.count,
      },
      closed: worker.closed,
    };
  }

  @Get('workers/:pid/routers')
  getRoutersByWorker(
    @Param('pid', ParseIntPipe) pid: number,
  ): RouterAPIResponse[] {
    const routers = this.mediasoupService.getRouterByWorkerPID(pid);
    return routers.map((router) => ({
      id: router.id,
      appData: router.appData,
      closed: router.closed,
    }));
  }

  @Get('workers/:pid/consumers')
  getConsumersByWorker(
    @Param('pid', ParseIntPipe) pid: number,
  ): ConsumerAPIResponse[] {
    const consumers = this.mediasoupService.getConsumers();
    return consumers
      .filter((consumer) => {
        const { appData } = this.mediasoupService.getRouterById(
          consumer.appData.routerId,
        );
        return appData.workerPid === pid;
      })
      .map((consumer) => ({
        id: consumer.id,
        kind: consumer.kind,
        type: consumer.type,
        score: consumer.score,
        paused: consumer.paused,
        appData: consumer.appData,
        rtpParameters: consumer.rtpParameters,
      }));
  }

  @Get('workers/:pid/producers')
  getProducersByWorker(
    @Param('pid', ParseIntPipe) pid: number,
  ): ProducerAPIResponse[] {
    const producers = this.mediasoupService.getProducers();
    return producers
      .filter((producer) => {
        const { appData } = this.mediasoupService.getRouterById(
          producer.appData.routerId,
        );
        return appData.workerPid === pid;
      })
      .map((producer) => ({
        id: producer.id,
        kind: producer.kind,
        type: producer.type,
        score: producer.score,
        paused: producer.paused,
        closed: producer.closed,
        appData: producer.appData,
      }));
  }

  @Delete('workers/:pid')
  closeWorker(@Param('pid', ParseIntPipe) pid: number): WorkerAPIResponse {
    const worker = this.mediasoupService.closeWorker(pid);
    return {
      pid: worker.pid,
      appData: {
        count: worker.appData.count,
      },
      closed: worker.closed,
    };
  }

  @Post('routers')
  async createRouter(): Promise<RouterAPIResponse> {
    const worker = this.mediasoupService.getRandomWorker();
    const router = await this.mediasoupService.createRouter(worker);
    return {
      id: router.id,
      appData: router.appData,
      closed: router.closed,
    };
  }

  @Get('routers')
  getRouters(): RouterAPIResponse[] {
    const routers = this.mediasoupService.getRouters();
    return routers.map((router) => ({
      id: router.id,
      appData: router.appData,
      closed: router.closed,
    }));
  }

  @Get('routers/:routerId')
  getRouterById(@Param('routerId') routerId: string): RouterAPIResponse {
    const router = this.mediasoupService.getRouterById(routerId);
    return {
      id: router.id,
      appData: router.appData,
      closed: router.closed,
    };
  }

  @Delete('routers/:routerId')
  closeRouter(@Param('routerId') routerId: string): RouterAPIResponse {
    const router = this.mediasoupService.closeRouter(routerId);
    return { id: router.id, appData: router.appData, closed: router.closed };
  }

  @Post(['routers/:routerId/transports', 'transports'])
  async createTransport(
    @Body() body: TransportCreateDto,
    @Param('routerId') routerId: string,
  ) {
    switch (body.type) {
      case 'direct': {
        const transport = await this.mediasoupService.createDirectTransport(
          routerId || body.routerId,
        );
        return {
          id: transport.id,
          appData: transport.appData,
          closed: transport.closed,
        };
      }

      case 'pipe': {
        const transport = await this.mediasoupService.createPipeTransport(
          routerId || body.routerId,
        );
        return {
          id: transport.id,
          appData: transport.appData,
          closed: transport.closed,
        };
      }

      case 'plain': {
        const transport = await this.mediasoupService.createPlainTransport(
          routerId || body.routerId,
          {
            comedia: false,
            rtcpMux: true,
          },
        );
        return {
          id: transport.id,
          appData: transport.appData,
          closed: transport.closed,
        };
      }

      case 'webrtc': {
        const transport = await this.mediasoupService.createWebRtcTransport(
          routerId || body.routerId,
        );
        return {
          id: transport.id,
          appData: transport.appData,
          dtlsParameters: transport.dtlsParameters,
          dtlsState: transport.dtlsState,
          dtlsRemoteCert: transport.dtlsRemoteCert,
          iceCandidates: transport.iceCandidates,
          iceParameters: transport.iceParameters,
          closed: transport.closed,
        };
      }

      default:
        throw new BadRequestException('Invalid request');
    }
  }

  @Get('routers/:routerId/transports')
  getTransportInRouter(
    @Param('routerId') routerId: string,
  ): TransportAPIResponse[] {
    const transports = this.mediasoupService.getTransports();
    return transports
      .filter((transport) => transport.appData.routerId === routerId)
      .map((transport) => ({
        id: transport.id,
        appData: transport.appData,
        closed: transport.closed,
      }));
  }

  @Get('routers/:routerId/consumers')
  getRouterConsumers(): ConsumerAPIResponse[] {
    const consumers = this.mediasoupService.getConsumers();
    return consumers.map((consumer) => ({
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    }));
  }

  @Get('routers/:routerId/producers')
  getRouterProducers(): ProducerAPIResponse[] {
    const producers = this.mediasoupService.getProducers();
    return producers.map((producer) => ({
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    }));
  }

  @Get('routers/:routerId/rtpCapabilities')
  getRouterRtpCapabilities(
    @Param('routerId') routerId: string,
  ): types.RtpCapabilities {
    const router = this.mediasoupService.getRouterById(routerId);
    return router.rtpCapabilities;
  }

  @Get('transports')
  getTransports(): TransportAPIResponse[] {
    const transports = this.mediasoupService.getTransports();
    return transports.map((transport) => ({
      id: transport.id,
      appData: transport.appData,
      closed: transport.closed,
    }));
  }

  @Post('transports/connect')
  async connectTransport(
    @Body() body: TransportConnectDto,
  ): Promise<{ connect: boolean }> {
    const connect = await this.mediasoupService.connectTransport(
      body.transportId,
      body.options,
    );
    return { connect };
  }

  @Get('transports/:transportId')
  getTransportById(
    @Param('transportId') transportId: string,
  ): TransportAPIResponse {
    const transport = this.mediasoupService.getTransportById(transportId);
    return {
      id: transport.id,
      appData: transport.appData,
      closed: transport.closed,
    };
  }

  @Delete('transports/:transportId')
  closeTransportById(
    @Param('transportId') transportId: string,
  ): TransportAPIResponse {
    const transport = this.mediasoupService.closeTransport(transportId);
    return {
      id: transport.id,
      appData: transport.appData,
      closed: transport.closed,
    };
  }

  @Get('transports/:transportId/restart-ice')
  async restartICE(
    @Param('transportId') transportId: string,
  ): Promise<types.IceParameters> {
    const restartICE =
      await this.mediasoupService.restartWebRtcIce(transportId);
    return restartICE;
  }

  @Get('transports/:transportId/dump')
  async getTransportDump(@Param('transportId') transportId: string) {
    const transport = this.mediasoupService.getTransportById(transportId);
    const transportDump = await transport.dump();
    return transportDump;
  }

  @Get('transports/:transportId/stats')
  async getTransportStats(@Param('transportId') transportId: string) {
    const transport = this.mediasoupService.getTransportById(transportId);
    const transportStats = await transport.getStats();
    return transportStats;
  }

  @Post('consumers')
  async createConsumer(
    @Body() body: ConsumerCreateDto,
  ): Promise<ConsumerAPIResponse> {
    const { transportId, producerId, rtpCapabilities } = body;
    const consumer = await this.mediasoupService.createConsumer(
      transportId,
      producerId,
      rtpCapabilities,
    );
    return {
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    };
  }

  @Get('consumers')
  getConsumers(): ConsumerAPIResponse[] {
    const consumers = this.mediasoupService.getConsumers();
    return consumers.map((consumer) => ({
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    }));
  }

  @Get('consumers/:consumerId')
  getConsumerById(
    @Param('consumerId') consumerId: string,
  ): ConsumerAPIResponse {
    const consumer = this.mediasoupService.getConsumerById(consumerId);
    return {
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    };
  }

  @Get('consumers/:consumerId/pause')
  async pauseConsumer(
    @Param('consumerId') consumerId: string,
  ): Promise<ConsumerAPIResponse> {
    const consumer = await this.mediasoupService.pauseConsumer(consumerId);
    return {
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    };
  }

  @Get('consumers/:consumerId/resume')
  async resumeConsumer(
    @Param('consumerId') consumerId: string,
  ): Promise<ConsumerAPIResponse> {
    const consumer = await this.mediasoupService.resumeConsumer(consumerId);
    return {
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    };
  }

  @Get('consumers/:consumerId/stats')
  async getCosumerStats(@Param('consumerId') consumerId: string) {
    const consumer = this.mediasoupService.getConsumerById(consumerId);
    const stats = await consumer.getStats();

    return stats;
  }

  @Get('consumers/:consumerId/dump')
  async getConsumerDump(@Param('consumerId') consumerId: string) {
    const consumer = this.mediasoupService.getConsumerById(consumerId);
    const dump = await consumer.dump();

    return dump;
  }

  @Delete('consumers/:consumerId')
  closeConsumer(@Param('consumerId') consumerId: string): ConsumerAPIResponse {
    const consumer = this.mediasoupService.closeConsumer(consumerId);
    return {
      id: consumer.id,
      kind: consumer.kind,
      type: consumer.type,
      score: consumer.score,
      paused: consumer.paused,
      appData: consumer.appData,
      rtpParameters: consumer.rtpParameters,
    };
  }

  @Post('producers')
  async createProducer(
    @Body() body: ProducerCreateDto,
  ): Promise<ProducerAPIResponse> {
    const { transportId, kind, rtpParameters } = body;
    const producer = await this.mediasoupService.createProducer(
      transportId,
      kind,
      rtpParameters,
    );
    return {
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    };
  }

  @Get('producers')
  getProducers(): ProducerAPIResponse[] {
    const producers = this.mediasoupService.getProducers();
    return producers.map((producer) => ({
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    }));
  }

  @Get('producers/:producerId')
  getProducerById(
    @Param('producerId') producerId: string,
  ): ProducerAPIResponse {
    const producer = this.mediasoupService.getProducerById(producerId);
    return {
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    };
  }

  @Get('producers/:producerId/pause')
  async pauseProducer(
    @Param('producerId') producerId: string,
  ): Promise<ProducerAPIResponse> {
    const producer = await this.mediasoupService.pauseProducer(producerId);

    return {
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    };
  }

  @Get('producers/:producerId/resume')
  async resumeProducer(
    @Param('producerId') producerId: string,
  ): Promise<ProducerAPIResponse> {
    const producer = await this.mediasoupService.resumeProducer(producerId);

    return {
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    };
  }

  @Get('producers/:producerId/stats')
  async getProducerStats(@Param('producerId') producerId: string) {
    const producer = this.mediasoupService.getProducerById(producerId);
    const stats = await producer.getStats();

    return stats;
  }

  @Get('producers/:producerId/dump')
  async getProducerDump(@Param('producerId') producerId: string) {
    const producer = this.mediasoupService.getProducerById(producerId);
    const dump = await producer.dump();

    return dump;
  }

  @Delete('producers/:producerId')
  closeProducer(@Param('producerId') producerId: string): ProducerAPIResponse {
    const producer = this.mediasoupService.closeProducer(producerId);
    return {
      id: producer.id,
      kind: producer.kind,
      type: producer.type,
      score: producer.score,
      paused: producer.paused,
      closed: producer.closed,
      appData: producer.appData,
    };
  }
}

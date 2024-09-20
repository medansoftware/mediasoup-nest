import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { createWorker, types } from 'mediasoup';
import AsyncLock from 'async-lock';
import { AllConfigType } from '@/app.type';
import { MediasoupException } from './mediasoup.exception';
import {
  ActiveSpeakerObserverAppData,
  AudioLevelObserverAppData,
  ConsumerProducerAppData,
  MediasoupConfig,
  MediasoupResource,
  MediasoupResourceType,
  RouterAppData,
  RouterEvent,
  RouterEventActiveSpeaker,
  RouterEventAudioLevel,
  RouterEventConsumer,
  RouterEventConsumerLayersChange,
  RouterEventConsumerScore,
  RouterEventConsumerTrace,
  RouterEventName,
  RouterEventProducer,
  RouterEventProducerScore,
  RouterEventProducerTrace,
  RouterEventProducerVideoOrientation,
  RouterEventTransport,
  TransportAppData,
  TransportMode,
  WorkerAppData,
  WorkerEvent,
  WorkerEventName,
} from './mediasoup.type';

@Injectable()
export class MediasoupService {
  private readonly lock = new AsyncLock();
  private readonly logger = new Logger(MediasoupService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private configService: ConfigService<AllConfigType>,
    @Inject('RESOURCE') private resource: MediasoupResource,
  ) {}

  /** Get mediasoup config */
  config() {
    return this.configService.get<MediasoupConfig>('mediasoup');
  }

  /**
   * Create a mediasoup worker
   * @param options Worker options
   */
  async createWorker(
    options?: Pick<types.WorkerSettings, 'logLevel' | 'logTags'>,
  ) {
    const { rtcMinPort, rtcMaxPort, webRtcServer } = this.config();
    const worker = await createWorker<WorkerAppData>({
      rtcMinPort,
      rtcMaxPort,
      appData: {
        count: {
          router: 0,
          consumer: 0,
          producer: 0,
          transport: 0,
        },
      },
      ...options,
    });

    if (webRtcServer.enable) {
      const portIncrement = this.resource.workers.length + 2;
      for (const listenInfo of webRtcServer.options.listenInfos) {
        listenInfo.port += portIncrement;
      }

      worker.appData.webRtcServer = await worker.createWebRtcServer(
        webRtcServer.options,
      );
    }

    this.observer(worker);
    return worker;
  }

  /** Get all workers */
  getWorkers(): types.Worker<WorkerAppData>[] {
    const { workers } = this.resource;
    return workers;
  }

  /**
   * Get worker by process id
   * @param PID Worker PID
   */
  getWorkerByPID(PID: number): types.Worker<WorkerAppData> {
    const worker = this.resource.workers.find((worker) => worker.pid === PID);
    if (worker) {
      return worker;
    }

    throw new MediasoupException('WorkerNotFound');
  }

  /**
   * Get random worker
   * @param exceptPID Worker process id
   */
  getRandomWorker(exceptPID?: number | number[]): types.Worker<WorkerAppData> {
    if (exceptPID) {
      const { workers } = this.resource;
      const availableWorkers = workers.filter((worker) =>
        Array.isArray(exceptPID)
          ? !exceptPID.includes(worker.pid)
          : worker.pid !== exceptPID,
      );

      if (availableWorkers.length > 0) {
        const index = Math.floor(Math.random() * availableWorkers.length);
        return availableWorkers[index];
      }

      throw new MediasoupException('WorkerLimitExceeded');
    }

    const { workers, currentWorker } = this.resource;
    const worker = workers[currentWorker];

    this.resource.currentWorker = (currentWorker + 1) % workers.length;

    return worker;
  }

  /**
   * Close worker
   * @param PID Worker process id
   */
  closeWorker(PID: number): types.Worker<WorkerAppData> {
    const worker = this.getWorkerByPID(PID);
    worker.close();
    return worker;
  }

  /**
   * Check is resource available
   * @param routerId Router Id
   */
  isResourceAvailable(routerId: string) {
    const { subProcessLimit } = this.config();
    const { appData } = this.getRouterById(routerId);
    const worker = this.getWorkerByPID(appData.workerPid);
    return worker.appData.count.consumer < subProcessLimit;
  }

  /**
   * Create a mediasoup router
   * @param worker Worker instance
   */
  async createRouter(worker: types.Worker<WorkerAppData>) {
    const {
      mediaCodecs,
      audioLevelObserverOptions,
      activeSpeakerObserverOptions,
    } = this.config();
    const router = await worker.createRouter<RouterAppData>({
      mediaCodecs,
      appData: {
        workerPid: worker.pid,
        count: {
          consumer: 0,
          producer: 0,
          transport: 0,
        },
      },
    });

    // create audio level observer
    await router.createAudioLevelObserver<AudioLevelObserverAppData>({
      ...audioLevelObserverOptions,
      appData: {
        routerId: router.id,
      },
    });

    // create active speaker observer
    await router.createActiveSpeakerObserver<ActiveSpeakerObserverAppData>({
      ...activeSpeakerObserverOptions,
      appData: {
        routerId: router.id,
      },
    });

    return router;
  }

  /** Get routers */
  getRouters(): types.Router<RouterAppData>[] {
    const { routers } = this.resource;
    return routers;
  }

  /**
   * Get router by id
   * @param id Router id
   */
  getRouterById(id: string): types.Router<RouterAppData> {
    const { routers } = this.resource;
    const router = routers.find((router) => router.id === id);

    if (router) {
      return router;
    }

    throw new MediasoupException('RouterNotFound');
  }

  /**
   * Get router by worker PID
   * @param PID Worker PID
   */
  getRoutersByWorkerPID(PID: number): types.Router<RouterAppData>[] {
    if (this.getWorkerByPID(PID)) {
      const { routers } = this.resource;
      return routers.filter((router) => router.appData.workerPid === PID);
    }

    throw new MediasoupException('WorkerNotFound');
  }

  /**
   * Pipe router
   * @param source Router source
   * @param target Router target
   * @param producerId Producer id
   */
  async pipeRouter(
    source: types.Router<RouterAppData> | string,
    target: types.Router<RouterAppData> | string,
    producerId: string,
  ) {
    if (typeof source === 'string') {
      source = this.getRouterById(source);
    }

    if (typeof target === 'string') {
      target = this.getRouterById(target);
    }

    const pipeRouter = await source.pipeToRouter({
      router: target,
      producerId,
    });

    return pipeRouter;
  }

  /**
   * Close router
   * @param id Router id
   */
  closeRouter(id: string): types.Router<RouterAppData> {
    const router = this.getRouterById(id);
    router.close();
    return router;
  }

  /**
   * Create a mediasoup direct transport
   * @param routerId Router id
   */
  createDirectTransport(routerId: string) {
    const router = this.getRouterById(routerId);
    const { transportOptions } = this.config();
    const transport = router.createDirectTransport<TransportAppData>(
      transportOptions.directTransportOptions,
    );

    Object.assign(transportOptions.directTransportOptions, {
      appData: {
        ...transportOptions.directTransportOptions.appData,
        connected: false,
        timestamp: Date.now(),
      },
    });

    return transport;
  }

  /**
   * Create a mediasoup pipe transport
   * @param routerId Router id
   * @param options Pipe transport options
   */
  createPipeTransport(
    routerId: string,
    options?: Omit<
      types.PipeTransportOptions<TransportAppData>,
      'listenInfo' | 'listenIp' | 'port'
    >,
  ) {
    const { transportOptions } = this.config();
    const router = this.getRouterById(routerId);

    Object.assign(transportOptions.pipeTransportOptions, {
      appData: {
        ...transportOptions.pipeTransportOptions.appData,
        connected: false,
        timestamp: Date.now(),
      },
    });

    const transport = router.createPipeTransport<TransportAppData>(
      Object.assign(transportOptions.pipeTransportOptions, options),
    );

    return transport;
  }

  /**
   * Create a mediasoup plain rtp transport
   * @param routerId Router id
   * @param options Plain transport options
   */
  createPlainTransport(
    routerId: string,
    options?: Omit<
      types.PlainTransportOptions<TransportAppData>,
      'listenInfo' | 'rtcpListenInfo' | 'listenIp' | 'port'
    >,
  ) {
    const { transportOptions } = this.config();
    const router = this.getRouterById(routerId);

    Object.assign(transportOptions.plainTransportOptions, {
      appData: {
        ...transportOptions.plainTransportOptions.appData,
        connected: false,
        timestamp: Date.now(),
      },
    });

    const transport = router.createPlainTransport<TransportAppData>(
      Object.assign(transportOptions.plainTransportOptions, options),
    );

    return transport;
  }

  /**
   * Create a mediasoup webrtc transport
   * @param routerId Router id
   */
  async createWebRtcTransport(
    routerId: string,
    mode?: TransportMode,
    options?: types.WebRtcTransportOptions<TransportAppData>,
  ) {
    const { transportOptions, webRtcServer } = this.config();
    const router = this.getRouterById(routerId);

    if (webRtcServer.enable) {
      const worker = this.getWorkerByPID(router.appData.workerPid);
      Object.assign(transportOptions.webRtcTransportOptions, {
        webRtcServer: worker.appData.webRtcServer,
        appData: {
          ...transportOptions.webRtcTransportOptions.appData,
          mode,
          routerId,
        },
      });
    }

    Object.assign(transportOptions.webRtcTransportOptions, {
      appData: {
        ...transportOptions.webRtcTransportOptions.appData,
        connected: false,
        timestamp: Date.now(),
      },
    });

    const transport = await router.createWebRtcTransport<TransportAppData>(
      Object.assign(transportOptions.webRtcTransportOptions, options),
    );

    return transport;
  }

  /**
   * Restart webrtc transport ICE
   * @param transportId Transport id
   */
  async restartWebRtcIce(transportId: string) {
    const transport = this.getTransportById<types.WebRtcTransport>(transportId);
    const newIce = await transport.restartIce();
    return newIce;
  }

  /** Get all transports */
  getTransports(): types.Transport<TransportAppData>[] {
    const { transports } = this.resource;
    return transports;
  }

  /**
   * Get transport by id
   * @param id Transport id
   */
  getTransportById<T = types.Transport<TransportAppData>>(id: string): T {
    const { transports } = this.resource;
    const transport = transports.find((transport) => transport.id === id);

    if (transport) {
      return transport as T;
    }

    throw new MediasoupException('TransportNotFound');
  }

  /**
   * Get transport by router id
   * @param id Router id
   */
  getTransportByRouterId<T = types.Transport<TransportAppData>>(id: string): T {
    const { transports } = this.resource;
    const transport = transports.filter(
      (transport) => transport.appData.routerId === id,
    );

    if (transport) {
      return transport as T;
    }

    throw new MediasoupException('TransportNotFound');
  }

  /**
   * Connect direct transport
   * @param transportId Transport id
   */
  async connectDirectTransport(transportId: string): Promise<boolean> {
    const transport =
      this.getTransportById<types.DirectTransport<TransportAppData>>(
        transportId,
      );
    await transport.connect();
    transport.appData.connected = true;

    return true;
  }

  /**
   * Connect pipe transport
   * @param transportId Transport id
   * @param options Connect options
   */
  async connectPipeTransport(
    transportId: string,
    options: {
      ip: string;
      port: number;
      srtpParameters?: types.SrtpParameters;
    },
  ): Promise<boolean> {
    const transport =
      this.getTransportById<types.PipeTransport<TransportAppData>>(transportId);
    await transport.connect(options);
    transport.appData.connected = true;

    return true;
  }

  /**
   * Connect plain transport
   * @param transportId Transport id
   * @param options Connect options
   */
  async connectPlainTransport(
    transportId: string,
    options: {
      ip: string;
      port: number;
      srtpParameters?: types.SrtpParameters;
    },
  ): Promise<boolean> {
    const transport =
      this.getTransportById<types.PlainTransport<TransportAppData>>(
        transportId,
      );
    await transport.connect(options);
    transport.appData.connected = true;

    return true;
  }

  /**
   * Connect webrtc transport
   * @param transportId Transport id
   * @param dtlsParameters DTLS parameters
   */
  async connectWebRtcTransport(
    transportId: string,
    dtlsParameters: types.DtlsParameters,
  ): Promise<boolean> {
    const transport =
      this.getTransportById<types.WebRtcTransport<TransportAppData>>(
        transportId,
      );

    await transport.connect({ dtlsParameters });
    transport.appData.connected = true;

    return true;
  }

  /**
   * Connect transport
   * @param id Transport id
   * @param options Connect options
   */
  async connectTransport(id: string, options?: any): Promise<boolean> {
    const findTransport = this.getTransportById(id);
    switch (findTransport.appData.type) {
      case 'direct':
        await this.connectDirectTransport(id);
        break;

      case 'pipe':
        await this.connectPipeTransport(id, options);
        break;

      case 'plain':
        await this.connectPlainTransport(id, options);
        break;

      case 'webrtc':
        await this.connectWebRtcTransport(id, options);
        break;

      default:
        return false;
    }

    return true;
  }

  /**
   * Close transport
   * @param id Transport id
   */
  closeTransport(id: string): types.Transport<TransportAppData> {
    const transport = this.getTransportById(id);
    transport.close();
    return transport;
  }

  /**
   * Create a mediasoup consumer
   * @param transportId Transport id
   * @param producerId Producer id
   * @param rtpCapabilities RTP Capabilities
   * @param options Consumer options
   */
  async createConsumer(
    transportId: string,
    producerId: string,
    rtpCapabilities: types.RtpCapabilities,
    options?: Omit<types.ConsumerOptions, 'producerId' | 'rtpCapabilities'>,
  ): Promise<types.Consumer<ConsumerProducerAppData>> {
    const transport = this.getTransportById(transportId);
    const router = this.getRouterById(transport.appData.routerId);

    if (router.canConsume({ producerId, rtpCapabilities })) {
      const consumer = await transport.consume<ConsumerProducerAppData>({
        producerId,
        rtpCapabilities,
        appData: {
          routerId: router.id,
          transportId,
        },
        ...options,
      });

      return consumer;
    }

    throw new MediasoupException('RouterCannotConsume');
  }

  /** Get consumers */
  getConsumers(): types.Consumer<ConsumerProducerAppData>[] {
    const { consumers } = this.resource;
    return consumers;
  }

  /**
   * Get consumer by id
   * @param id Consumer id
   */
  getConsumerById(id: string): types.Consumer<ConsumerProducerAppData> {
    const { consumers } = this.resource;
    const consumer = consumers.find((consumer) => consumer.id === id);

    if (consumer) {
      return consumer;
    }

    throw new MediasoupException('ConsumerNotFound');
  }

  /**
   * Pause consumer
   * @param id Consumer id
   */
  async pauseConsumer(
    id: string,
  ): Promise<types.Consumer<ConsumerProducerAppData>> {
    const consumer = this.getConsumerById(id);
    await consumer.pause();
    return consumer;
  }

  /**
   * Resume consumer
   * @param id Consumer id
   */
  async resumeConsumer(
    id: string,
  ): Promise<types.Consumer<ConsumerProducerAppData>> {
    const consumer = this.getConsumerById(id);
    await consumer.resume();
    return consumer;
  }

  /**
   * Close consumer
   * @param id Consumer id
   */
  closeConsumer(id: string): types.Consumer<ConsumerProducerAppData> {
    const consumer = this.getConsumerById(id);
    consumer.close();
    return consumer;
  }

  /**
   * Create a mediasoup producer
   * @param transportId Transport id
   * @param kind Media kind
   * @param rtpParameters RTP Parameters
   */
  async createProducer(
    transportId: string,
    kind: types.MediaKind,
    rtpParameters: types.RtpParameters,
  ): Promise<types.Producer<ConsumerProducerAppData>> {
    const transport = this.getTransportById(transportId);
    const producer = await transport.produce<ConsumerProducerAppData>({
      kind,
      rtpParameters,
      appData: {
        routerId: transport.appData.routerId,
        transportId: transport.id,
      },
    });

    return producer;
  }

  /** Get producers */
  getProducers(): types.Producer<ConsumerProducerAppData>[] {
    const { producers } = this.resource;
    return producers;
  }

  /**
   * Get producer by id
   * @param id Producer id
   */
  getProducerById(id: string): types.Producer<ConsumerProducerAppData> {
    const { producers } = this.resource;
    const producer = producers.find((producer) => producer.id === id);
    if (producer) {
      return producer;
    }

    throw new MediasoupException('ProducerNotFound');
  }

  /**
   * Pause producer
   * @param id Producer id
   */
  async pauseProducer(
    id: string,
  ): Promise<types.Producer<ConsumerProducerAppData>> {
    const producer = this.getProducerById(id);
    await producer.pause();
    return producer;
  }

  /**
   * Resume producer
   * @param id Producer id
   */
  async resumeProducer(
    id: string,
  ): Promise<types.Producer<ConsumerProducerAppData>> {
    const producer = this.getProducerById(id);
    await producer.resume();
    return producer;
  }

  /**
   * Close producer
   * @param id Producer id
   */
  closeProducer(id: string): types.Producer<ConsumerProducerAppData> {
    const producer = this.getProducerById(id);
    producer.close();
    return producer;
  }

  /**
   * Get audio level observer by router id
   * @param routerId Router id
   */
  getAudioLevelObserver(
    routerId: string,
  ): types.AudioLevelObserver<AudioLevelObserverAppData> {
    const audioLevelObserver = this.resource.audioLevelObserver.find(
      (audioLevelObserver) => audioLevelObserver.appData.routerId === routerId,
    );

    if (audioLevelObserver) {
      return audioLevelObserver;
    }

    throw new MediasoupException('AudioLevelObserverNotFound');
  }

  /**
   * Get active speaker observer by router id
   * @param routerId Router id
   */
  getActiveSpeakerObserver(
    routerId: string,
  ): types.ActiveSpeakerObserver<ActiveSpeakerObserverAppData> {
    const activeSpeakerObserver = this.resource.activeSpeakerObserver.find(
      (activeSpeakerObserver) =>
        activeSpeakerObserver.appData.routerId === routerId,
    );

    if (activeSpeakerObserver) {
      return activeSpeakerObserver;
    }

    throw new MediasoupException('ActiveSpeakerObserverNotFound');
  }

  /**
   * Add to resource
   * @param resource Mediasoup resource
   */
  async addToResource<T extends MediasoupResourceType>(
    resource: MediasoupResourceType,
  ): Promise<T> {
    await this.lock.acquire('resourceLock', async () => {
      if (resource instanceof types.Worker) {
        this.resource.workers.push(resource as types.Worker<WorkerAppData>);
      } else if (resource instanceof types.Router) {
        this.resource.routers.push(resource as types.Router<RouterAppData>);
      } else if (resource instanceof types.Consumer) {
        this.resource.consumers.push(
          resource as types.Consumer<ConsumerProducerAppData>,
        );
      } else if (resource instanceof types.Producer) {
        const isExist = this.resource.producers.find(
          (producer) => producer.id === resource.id,
        );

        if (!isExist) {
          this.resource.producers.push(
            resource as types.Producer<ConsumerProducerAppData>,
          );
        }
      } else if (resource instanceof types.Transport) {
        this.resource.transports.push(
          resource as types.Transport<TransportAppData>,
        );
      } else if (resource instanceof types.AudioLevelObserver) {
        this.resource.audioLevelObserver.push(
          resource as types.AudioLevelObserver<AudioLevelObserverAppData>,
        );
      } else if (resource instanceof types.ActiveSpeakerObserver) {
        this.resource.activeSpeakerObserver.push(
          resource as types.ActiveSpeakerObserver<ActiveSpeakerObserverAppData>,
        );
      }
    });

    return resource as T;
  }

  /**
   * Remove from resource
   * @param resource Mediasoup resource
   */
  async removeFromResource(resource: MediasoupResourceType) {
    const { workers, routers } = this.resource;

    await this.lock.acquire('resourceLock', async () => {
      // resource type
      if (resource instanceof types.Worker) {
        this.resource.workers = workers.filter((i) => i.pid !== resource.pid);
      } else if (resource instanceof types.Router) {
        this.resource.routers = routers.filter((i) => i.id !== resource.id);
      } else if (resource instanceof types.Consumer) {
        this.resource.consumers = this.resource.consumers.filter(
          (i) => i.id !== resource.id,
        );
      } else if (resource instanceof types.Producer) {
        this.resource.producers = this.resource.producers.filter(
          (i) => i.id !== resource.id,
        );
      } else if (resource instanceof types.Transport) {
        this.resource.transports = this.resource.transports.filter(
          (i) => i.id !== resource.id,
        );
      } else if (resource instanceof types.AudioLevelObserver) {
        this.resource.audioLevelObserver =
          this.resource.audioLevelObserver.filter((i) => i.id !== resource.id);
      } else if (resource instanceof types.ActiveSpeakerObserver) {
        this.resource.activeSpeakerObserver =
          this.resource.activeSpeakerObserver.filter(
            (i) => i.id !== resource.id,
          );
      }

      if (!resource.closed) {
        resource.close();
      }
    });

    return resource;
  }

  /**
   * Broadcast event
   * @param name Event name
   * @param data Event data
   */
  broadcastEvent<T = RouterEvent>(
    name: WorkerEventName | RouterEventName,
    data: T,
  ) {
    this.eventEmitter.emit(name, data);
  }

  /**
   * Handle mediasoup observer
   * @param newWorker Worker instance
   */
  async observer(newWorker: types.Worker) {
    const worker =
      await this.addToResource<types.Worker<WorkerAppData>>(newWorker);

    worker.on('died', (error) => {
      this.broadcastEvent<WorkerEvent>(WorkerEventName.Error, {
        pid: worker.pid,
        name: 'error',
        error,
        appData: {
          count: worker.appData?.count,
        },
      });
      this.removeFromResource(worker);
    });

    worker.on('subprocessclose', () => {
      this.broadcastEvent<WorkerEvent>(WorkerEventName.SubprocessClose, {
        pid: worker.pid,
        name: 'subprocessclose',
        appData: {
          count: worker.appData?.count,
        },
      });
      this.removeFromResource(worker);
    });

    worker.observer.on('close', () => {
      this.broadcastEvent<WorkerEvent>(WorkerEventName.Close, {
        pid: worker.pid,
        name: 'close',
        appData: {
          count: worker.appData?.count,
        },
      });
      this.removeFromResource(worker);
    });

    worker.observer.on('newwebrtcserver', (webRtcServer) => {
      worker.appData = {
        ...worker.appData,
        webRtcServer,
      };

      this.broadcastEvent<WorkerEvent>(WorkerEventName.NewWebRTCServer, {
        pid: worker.pid,
        name: 'newwebrtcserver',
      });
    });

    worker.observer.on('newrouter', async (newRouter) => {
      const router =
        await this.addToResource<types.Router<RouterAppData>>(newRouter);

      router.on('@close', () => {
        // router event : closed
        this.broadcastEvent(RouterEventName.Closed, { id: router.id });

        // ? decrement router count for usage report
        this.workerUsageReport(worker.pid, 'decrement', 'router');
        this.removeFromResource(router);
      });

      // router event : opened
      this.broadcastEvent(RouterEventName.Opened, { id: router.id });

      // ? increment router count for usage report
      this.workerUsageReport(worker.pid, 'increment', 'router');

      router.observer.on('newrtpobserver', async (rtpObserver) => {
        // RTP observer closed
        rtpObserver.on('routerclose', () => {
          this.removeFromResource(rtpObserver);
        });

        /**
         * Handle audio level observer
         * @see https://mediasoup.org/documentation/v3/mediasoup/api/#AudioLevelObserver
         */
        if (rtpObserver instanceof types.AudioLevelObserver) {
          const audioLevelObserver =
            await this.addToResource<
              types.AudioLevelObserver<AudioLevelObserverAppData>
            >(rtpObserver);

          // router event : volumes
          audioLevelObserver.on('volumes', (volumes) => {
            this.broadcastEvent<RouterEventAudioLevel>(
              RouterEventName.AudioLevel,
              {
                id: router.id,
                volumes,
              },
            );
          });

          // router event : silence
          audioLevelObserver.on('silence', () => {
            this.broadcastEvent<RouterEventAudioLevel>(
              RouterEventName.AudioLevel,
              {
                id: router.id,
                silence: true,
              },
            );
          });
        }

        /**
         * Handle active speaker observer
         * @see https://mediasoup.org/documentation/v3/mediasoup/api/#ActiveSpeakerObserver
         */
        if (rtpObserver instanceof types.ActiveSpeakerObserver) {
          const activeSpeakerObserver =
            await this.addToResource<
              types.ActiveSpeakerObserver<ActiveSpeakerObserverAppData>
            >(rtpObserver);

          activeSpeakerObserver.on('dominantspeaker', (dominantSpeaker) => {
            // router event : active speaker
            this.broadcastEvent<RouterEventActiveSpeaker>(
              RouterEventName.ActiveSpeaker,
              {
                id: router.id,
                producer:
                  dominantSpeaker.producer as types.Producer<ConsumerProducerAppData>,
              },
            );
          });
        }
      });

      router.observer.on('newtransport', async (newTransport) => {
        newTransport.appData = {
          ...newTransport.appData,
          routerId: router.id,
        };
        const transport =
          await this.addToResource<types.Transport<TransportAppData>>(
            newTransport,
          );

        // router event : new transport
        this.broadcastEvent<RouterEventTransport>(
          RouterEventName.NewTransport,
          {
            id: router.id,
            transport,
          },
        );

        // ? increment transport count for usage report
        this.workerUsageReport(worker.pid, 'increment', 'transport');
        this.routerUsageReport(router.id, 'increment', 'transport');

        transport.observer.on('close', () => {
          // router event : transport close
          this.broadcastEvent<RouterEventTransport>(
            RouterEventName.TransportClose,
            {
              id: router.id,
              transport,
            },
          );

          // ? decrement transport count for usage report
          this.workerUsageReport(worker.pid, 'decrement', 'transport');
          this.routerUsageReport(router.id, 'decrement', 'transport');
          this.removeFromResource(transport);
        });

        // ? is webrtc transport
        if (transport instanceof types.WebRtcTransport) {
          const webRtcTransport = this.getTransportById<
            types.WebRtcTransport<TransportAppData>
          >(transport.id);

          webRtcTransport.on('icestatechange', (state) => {
            this.logger.debug(`ICE ${state}`);
            if (state === 'connected') {
              webRtcTransport.appData.connected = true;
            }

            if (state === 'disconnected') {
              webRtcTransport.appData.connected = false;
            }
          });

          webRtcTransport.on('dtlsstatechange', (state) => {
            this.logger.debug(`DTLS ${state}`);
            if (state === 'closed') {
              webRtcTransport.close();
            }
          });

          webRtcTransport.on('sctpstatechange', (state) => {
            this.logger.debug(`SCTP ${state}`);
          });
        }

        /**
         * * Consumer transport
         */
        transport.observer.on('newconsumer', async (newConsumer) => {
          const consumer =
            await this.addToResource<types.Consumer<ConsumerProducerAppData>>(
              newConsumer,
            );
          // router event : new consumer
          this.broadcastEvent<RouterEventConsumer>(
            RouterEventName.NewConsumer,
            {
              id: router.id,
              consumer,
            },
          );

          // set consumer app data
          consumer.appData.routerId = router.id;
          consumer.appData.transportId = transport.id;

          // ? increment consumer count for usage report
          this.workerUsageReport(worker.pid, 'increment', 'consumer');
          this.routerUsageReport(router.id, 'increment', 'consumer');

          consumer.observer.on('close', () => {
            // router event : consumer close
            this.broadcastEvent<RouterEventConsumer>(
              RouterEventName.ConsumerClose,
              {
                id: router.id,
                consumer,
              },
            );

            // ? decrement consumer count for usage report
            this.workerUsageReport(worker.pid, 'decrement', 'consumer');
            this.routerUsageReport(router.id, 'decrement', 'consumer');
            this.removeFromResource(consumer);
          });

          consumer.on('producerpause', async () => {
            await consumer.pause();
          });

          consumer.on('producerresume', async () => {
            await consumer.resume();
          });

          consumer.observer.on('pause', () => {
            // router event : consumer pause
            this.broadcastEvent<RouterEventConsumer>(
              RouterEventName.ConsumerPause,
              {
                id: router.id,
                consumer,
              },
            );
          });

          consumer.observer.on('resume', () => {
            // router event : consumer resume
            this.broadcastEvent<RouterEventConsumer>(
              RouterEventName.ConsumerResume,
              {
                id: router.id,
                consumer,
              },
            );
          });

          consumer.observer.on('score', (score) => {
            // router event : consumer score
            this.broadcastEvent<RouterEventConsumerScore>(
              RouterEventName.ConsumerScore,
              {
                id: router.id,
                consumer,
                score,
              },
            );
          });

          consumer.observer.on('trace', (trace) => {
            // router event : consumer trace
            this.broadcastEvent<RouterEventConsumerTrace>(
              RouterEventName.ConsumerTrace,
              {
                id: router.id,
                consumer,
                trace,
              },
            );
          });

          consumer.observer.on('layerschange', (layers) => {
            // router event : consumer layers change
            this.broadcastEvent<RouterEventConsumerLayersChange>(
              RouterEventName.ConsumerLayersChange,
              {
                id: router.id,
                consumer,
                layers,
              },
            );
          });
        });

        /**
         * * Producer transport
         */
        transport.observer.on('newproducer', async (newProducer) => {
          const producer =
            await this.addToResource<types.Producer<ConsumerProducerAppData>>(
              newProducer,
            );
          // router event : new producer
          this.broadcastEvent<RouterEventProducer>(
            RouterEventName.NewProducer,
            {
              id: router.id,
              producer,
            },
          );

          // set producer app data
          producer.appData.routerId = router.id;
          producer.appData.transportId = transport.id;

          // ? increment producer count for usage report
          this.workerUsageReport(worker.pid, 'increment', 'producer');
          this.routerUsageReport(router.id, 'increment', 'producer');

          if (producer.kind === 'audio') {
            await this.getAudioLevelObserver(router.id).addProducer({
              producerId: producer.id,
            });

            await this.getActiveSpeakerObserver(router.id).addProducer({
              producerId: producer.id,
            });
          }

          producer.observer.on('close', () => {
            // router event : producer close
            this.broadcastEvent<RouterEventProducer>(
              RouterEventName.ProducerClose,
              {
                id: router.id,
                producer,
              },
            );

            // ? increment decrement count for usage report
            this.workerUsageReport(worker.pid, 'decrement', 'producer');
            this.routerUsageReport(router.id, 'decrement', 'producer');
            this.removeFromResource(producer);
          });

          producer.observer.on('pause', () => {
            // router event : producer pause
            this.broadcastEvent<RouterEventProducer>(
              RouterEventName.ProducerPause,
              {
                id: router.id,
                producer,
              },
            );
          });

          producer.observer.on('resume', () => {
            // router event : producer resume
            this.broadcastEvent<RouterEventProducer>(
              RouterEventName.ProducerResume,
              {
                id: router.id,
                producer,
              },
            );
          });

          producer.observer.on('score', (score) => {
            // router event : producer score
            this.broadcastEvent<RouterEventProducerScore>(
              RouterEventName.ProducerScore,
              {
                id: router.id,
                producer,
                score,
              },
            );
          });

          producer.observer.on('trace', (trace) => {
            // router event : producer trace
            this.broadcastEvent<RouterEventProducerTrace>(
              RouterEventName.ProducerTrace,
              {
                id: router.id,
                producer,
                trace,
              },
            );
          });

          producer.observer.on('videoorientationchange', (videoOrientation) => {
            // router event : producer video orientation
            this.broadcastEvent<RouterEventProducerVideoOrientation>(
              RouterEventName.ProducerVideoOrientation,
              {
                id: router.id,
                producer,
                videoOrientation,
              },
            );
          });
        });
      });
    });
  }

  /**
   * Worker usage report
   * @param pid Worker PID
   * @param mode Incerment / Decrement
   * @param type Resource name
   */
  private workerUsageReport(
    pid: number,
    mode: 'increment' | 'decrement',
    type: 'router' | 'consumer' | 'producer' | 'transport',
  ) {
    const worker = this.getWorkerByPID(pid);
    const countType = worker.appData.count[type];
    switch (type) {
      case 'router':
        if (mode === 'increment') {
          worker.appData.count[type] = countType + 1;
        } else {
          worker.appData.count[type] = countType - 1;
        }
        break;

      case 'consumer':
        if (mode === 'increment') {
          worker.appData.count[type] = countType + 1;
        } else {
          worker.appData.count[type] = countType - 1;
        }
        break;

      case 'producer':
        if (mode === 'increment') {
          worker.appData.count[type] = countType + 1;
        } else {
          worker.appData.count[type] = countType - 1;
        }
        break;

      case 'transport':
        if (mode === 'increment') {
          worker.appData.count[type] = countType + 1;
        } else {
          worker.appData.count[type] = countType - 1;
        }
        break;
    }
  }

  /**
   * Router usage report
   * @param pid Router id
   * @param mode Incerment / Decrement
   * @param type Resource name
   */
  private routerUsageReport(
    id: string,
    mode: 'increment' | 'decrement',
    type: 'consumer' | 'producer' | 'transport',
  ) {
    const router = this.getRouterById(id);
    const countType = router.appData.count[type];
    switch (type) {
      case 'consumer':
        if (mode === 'increment') {
          router.appData.count[type] = countType + 1;
        } else {
          router.appData.count[type] = countType - 1;
        }
        break;

      case 'producer':
        if (mode === 'increment') {
          router.appData.count[type] = countType + 1;
        } else {
          router.appData.count[type] = countType - 1;
        }
        break;

      case 'transport':
        if (mode === 'increment') {
          router.appData.count[type] = countType + 1;
        } else {
          router.appData.count[type] = countType - 1;
        }
        break;
    }
  }

  /**
   * Automatically close disconnected transport
   */
  @Cron('30 * * * * *', {
    name: 'CloseDisconnectedTransport',
  })
  closeDisconnectedTransport() {
    for (let i = 0; i < this.resource.transports.length; i++) {
      const transport = this.resource.transports[i];
      const { connected, timestamp } = transport.appData;
      const { transportAutoCloseTimeout } = this.config();
      const timeout = Math.floor((Date.now() - timestamp) / 1000);

      if (!connected && timeout >= transportAutoCloseTimeout) {
        transport.close();
      }
    }
  }
}

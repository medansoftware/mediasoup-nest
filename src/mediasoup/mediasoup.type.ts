import { types } from 'mediasoup';

export type MediasoupConfig = {
  workerCount: number;
  workerLogTags: types.WorkerLogTag[];
  workerLogLevel: types.WorkerLogLevel;
  rtcMinPort: number;
  rtcMaxPort: number;
  listenIP: string;
  anouncedIP: string;
  webRtcServer: {
    enable: boolean;
    options: types.WebRtcServerOptions;
  };
  mediaCodecs: types.RtpCodecCapability[];
  subProcessLimit: number;
  transportOptions: {
    directTransportOptions: types.DirectTransportOptions<TransportAppData>;
    pipeTransportOptions: types.PipeTransportOptions<TransportAppData>;
    plainTransportOptions: types.PlainTransportOptions<TransportAppData>;
    webRtcTransportOptions: types.WebRtcTransportOptions<TransportAppData>;
  };
  transportTraceEventTypes: types.TransportTraceEventType[];
  transportAutoCloseTimeout: number;
  audioLevelObserverOptions: types.AudioLevelObserverOptions;
  activeSpeakerObserverOptions: types.ActiveSpeakerObserverOptions;
};

export type TransportType = 'direct' | 'pipe' | 'plain' | 'webrtc';

export type TransportMode = 'recv' | 'send';

export type WorkerAppData = {
  count: {
    router: number;
    consumer: number;
    producer: number;
    transport: number;
  };
  webRtcServer?: types.WebRtcServer<types.AppData>;
};

export type RouterAppData = {
  workerPid?: number;
  count: {
    consumer: number;
    producer: number;
    transport: number;
  };
};

export type TransportAppData = {
  type: TransportType;
  mode?: TransportMode;
  routerId?: string;
  timestamp?: number;
  connected?: boolean;
};

export type ConsumerProducerAppData = {
  routerId?: string;
  transportId?: string;
};

export type AudioLevelObserverAppData = {
  routerId: string;
};

export type ActiveSpeakerObserverAppData = {
  routerId: string;
};

export type MediasoupResource = {
  workers: types.Worker<WorkerAppData>[];
  routers: types.Router<RouterAppData>[];
  consumers: types.Consumer<ConsumerProducerAppData>[];
  producers: types.Producer<ConsumerProducerAppData>[];
  transports: types.Transport<TransportAppData>[];
  audioLevelObserver: types.AudioLevelObserver<AudioLevelObserverAppData>[];
  activeSpeakerObserver: types.ActiveSpeakerObserver<ActiveSpeakerObserverAppData>[];
  currentWorker: number;
};

export type MediasoupResourceType =
  | types.Worker
  | types.Router
  | types.Consumer
  | types.Producer
  | types.Transport
  | types.RtpObserver
  | types.AudioLevelObserver
  | types.ActiveSpeakerObserver;

export type WorkerEvent = {
  pid: number;
  name: 'close' | 'error' | 'subprocessclose' | 'newwebrtcserver';
  error?: Error;
  appData?: WorkerAppData;
};

export enum WorkerEventName {
  Error = 'Worker.Error',
  Close = 'Worker.Close',
  SubprocessClose = 'Worker.SubprocessClose',
  NewWebRTCServer = 'Worker.NewWebRTCServer',
}

export type RouterEvent = {
  id: string;
};

export enum RouterEventName {
  // Router event
  Opened = 'Router.Opened',
  Closed = 'Router.Closed',

  // Audio level & Active speaker
  AudioLevel = 'Router.AudioLevel',
  ActiveSpeaker = 'Router.ActiveSpeaker',

  // Transport
  NewTransport = 'Router.NewTransport',
  TransportEvent = 'Router.TransportEvent',
  TransportClose = 'Router.TransportClose',

  // Consumer
  NewConsumer = 'Router.NewConsumer',
  ConsumerScore = 'Router.ConsumerScore',
  ConsumerPause = 'Router.ConsumerPause',
  ConsumerResume = 'Router.ConsumerResume',
  ConsumerClose = 'Router.ConsumerClose',
  ConsumerTrace = 'Router.ConsumerTrace',

  // Producer
  NewProducer = 'Router.NewProducer',
  ProducerScore = 'Router.ProducerScore',
  ProducerPause = 'Router.ProducerPause',
  ProducerResume = 'Router.ProducerResume',
  ProducerClose = 'Router.ProducerClose',
  ProducerTrace = 'Router.ProducerTrace',

  ConsumerLayersChange = 'Router.ConsumerLayersChange',
  ProducerVideoOrientation = 'Router.ProducerVideoOrientation',
}

export type RouterEventTransport = RouterEvent & {
  transport: types.Transport<TransportAppData>;
  traceEvent?: types.TransportTraceEventData;
};

export type RouterEventConsumer = RouterEvent & {
  consumer: types.Consumer<ConsumerProducerAppData>;
};

export type RouterEventConsumerScore = RouterEventConsumer & {
  score: types.ConsumerScore;
};

export type RouterEventConsumerTrace = RouterEventConsumer & {
  trace: types.ConsumerTraceEventData;
};

export type RouterEventConsumerLayersChange = RouterEventConsumer & {
  layers: types.ConsumerLayers;
};

export type RouterEventProducer = RouterEvent & {
  producer: types.Producer<ConsumerProducerAppData>;
};

export type RouterEventProducerScore = RouterEventProducer & {
  score: types.ProducerScore[];
};

export type RouterEventProducerTrace = RouterEventProducer & {
  trace: types.ProducerTraceEventData;
};

export type RouterEventProducerVideoOrientation = RouterEventProducer & {
  videoOrientation: types.ProducerVideoOrientation;
};

export type RouterEventAudioLevel = RouterEvent & {
  volumes?: types.AudioLevelObserverVolume[];
  silence?: boolean;
};

export type RouterEventActiveSpeaker = RouterEventProducer;

export type WorkerAPIResponse = Pick<
  types.Worker,
  'pid' | 'appData' | 'closed'
>;
export type RouterAPIResponse = Pick<types.Router, 'id' | 'appData' | 'closed'>;

export type TransportAPIResponse = Pick<
  types.Transport,
  'id' | 'appData' | 'closed'
>;

export type ConsumerAPIResponse = Pick<
  types.Consumer,
  'id' | 'kind' | 'type' | 'score' | 'paused' | 'appData' | 'rtpParameters'
>;

export type ProducerAPIResponse = Pick<
  types.Producer,
  'id' | 'kind' | 'type' | 'score' | 'paused' | 'closed' | 'appData'
>;

export type MediasoupErrorMessage =
  | 'WorkerNotFound'
  | 'WorkerLimitExceeded'
  | 'RouterNotFound'
  | 'TransportNotFound'
  | 'RouterCannotConsume'
  | 'ConsumerNotFound'
  | 'ProducerNotFound'
  | 'AudioLevelObserverNotFound'
  | 'ActiveSpeakerObserverNotFound';

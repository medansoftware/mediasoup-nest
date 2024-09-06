import { registerAs } from '@nestjs/config';
import { types } from 'mediasoup';
import { MediasoupConfig } from './mediasoup.type';

const mediaCodecs: types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 2,
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/h264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/h264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

const listenIP = process.env.listenIP || '0.0.0.0';

const anouncedIP = process.env.anouncedIP;

const subProcessLimit = parseInt(process.env.subProcessLimit);

const config: MediasoupConfig = {
  workerCount: parseInt(process.env.workerCount) || 1,
  rtcMinPort: parseInt(process.env.rtcMinPort) || 10000,
  rtcMaxPort: parseInt(process.env.rtcMaxPort) || 60000,
  listenIP: process.env.listenIP || '0.0.0.0',
  anouncedIP,
  mediaCodecs,
  webRtcServer: {
    enable: process.env.webRtcServer === 'true',
    options: {
      listenInfos: [
        {
          ip: listenIP,
          protocol: 'udp',
          announcedAddress: anouncedIP,
          port: parseInt(process.env.webRtcServerPort) || 44444,
        },
        {
          ip: listenIP,
          protocol: 'tcp',
          announcedAddress: anouncedIP,
          port: parseInt(process.env.webRtcServerPort) || 44444,
        },
      ],
    },
  },
  subProcessLimit: !isNaN(subProcessLimit) ? subProcessLimit : 500,
  transportOptions: {
    directTransportOptions: {
      maxMessageSize: 262144,
      appData: {
        type: 'direct',
      },
    },
    pipeTransportOptions: {
      listenInfo: {
        ip: listenIP,
        announcedAddress: anouncedIP,
        protocol: 'udp',
      },
      appData: {
        type: 'pipe',
      },
    },
    plainTransportOptions: {
      listenInfo: {
        ip: listenIP,
        protocol: 'udp',
        announcedAddress: anouncedIP,
      },
      appData: {
        type: 'plain',
      },
    },
    webRtcTransportOptions: {
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      preferTcp: false,
      enableSctp: false,
      appData: {
        type: 'webrtc',
      },
      listenIps: [
        {
          ip: listenIP,
          announcedIp: anouncedIP,
        },
      ],
    },
  },
  transportTraceEventTypes: ['bwe', 'probation'],
  transportAutoCloseTimeout: 30,
  audioLevelObserverOptions: {
    interval: 1000,
    threshold: -80,
    maxEntries: 1,
  },
  activeSpeakerObserverOptions: {
    interval: 300,
  },
};

export default registerAs<MediasoupConfig>('mediasoup', () => config);

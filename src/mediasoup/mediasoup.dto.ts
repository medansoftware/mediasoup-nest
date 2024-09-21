import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { types } from 'mediasoup';
import { TransportType } from './mediasoup.type';

export class WorkerCreateDto {
  @IsIn(['debug', 'error', 'none', 'warn'])
  @IsOptional()
  logLevel: types.WorkerLogLevel;

  @IsArray()
  @IsOptional()
  @IsIn(
    [
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
      'rtx',
      'bwe',
      'score',
      'simulcast',
      'svc',
      'sctp',
      'message',
    ],
    { each: true },
  )
  logTags: types.WorkerLogTag[];
}

export class WorkerUpdateDto extends PartialType(WorkerCreateDto) {}

export class TransportCreateDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['direct', 'pipe', 'plain', 'webrtc'])
  type: TransportType;

  @IsOptional()
  @IsString()
  routerId: string;

  @IsOptional()
  options:
    | types.DirectTransportOptions
    | types.PipeTransportOptions
    | types.PlainTransportOptions
    | types.WebRtcTransportOptions;
}

export class TransportConnectDto {
  @IsNotEmpty()
  @IsString()
  transportId: string;

  @IsOptional()
  options: any;
}

export class ConsumerCreateDto {
  @IsNotEmpty()
  @IsString()
  transportId: string;

  @IsNotEmpty()
  @IsString()
  producerId: string;

  @IsNotEmpty()
  rtpCapabilities: types.RtpCapabilities;
}

export class ProducerCreateDto {
  @IsNotEmpty()
  @IsString()
  transportId: string;

  @IsNotEmpty()
  @IsIn(['audio', 'video'])
  kind: types.MediaKind;

  @IsNotEmpty()
  rtpParameters: types.RtpParameters;
}

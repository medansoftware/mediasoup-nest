import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { types } from 'mediasoup';
import { TransportType } from './mediasoup.type';

export class WorkerCreateDto {
  @IsNotEmpty()
  @IsIn(['debug', 'error', 'none', 'warn'])
  logLevel: types.WorkerLogLevel;

  @IsArray()
  @ArrayNotEmpty()
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

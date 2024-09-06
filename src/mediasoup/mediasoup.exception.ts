import { MediasoupErrorMessage } from './mediasoup.type';

export class MediasoupException extends Error {
  message: MediasoupErrorMessage;
  constructor(message: MediasoupErrorMessage) {
    super(message);
  }
}

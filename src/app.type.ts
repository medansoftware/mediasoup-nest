import { MediasoupConfig } from './mediasoup/mediasoup.type';

export type AppEnv = 'development' | 'testing' | 'production';

export type AppConfig = {
  environment: AppEnv;
};

export type AllConfigType = {
  app: AppConfig;
  mediasoup: MediasoupConfig;
};

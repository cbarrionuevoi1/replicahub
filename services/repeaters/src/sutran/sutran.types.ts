import { RepeaterRuntimeConfig } from '../core/repeater.types';

export type SutranApiVersion = 'v1' | 'v2';
export type SutranEvent = 'ER' | 'PA' | 'BP';

/** Trama definida por SUTRAN. */
export interface SutranFrame {
  plate: string;
  geo: [number, number]; // [latitud, longitud]
  direction: number;
  event: SutranEvent;
  speed: number;
  time_device: string; // YYYY-MM-DD HH:mm:ss en UTC-5 (Perú)
  imei?: string;
}

export interface SutranRuntimeConfig extends RepeaterRuntimeConfig {
  code: 'SUTRAN';
  auth: {
    type: 'TOKEN_HEADER';
    headerName: 'access-token' | string;
    token: string;
  };
  config?: {
    apiVersion?: SutranApiVersion;
    batchSize?: number;
    eventParameterName?: string;
    panicParameterName?: string;
    stopSpeedThreshold?: number;
    includeImei?: boolean;
  } & Record<string, unknown>;
}

export interface SutranResponseLike {
  status?: number | string;
  code?: number | string;
  message?: string;
  result?: unknown;
  [key: string]: unknown;
}

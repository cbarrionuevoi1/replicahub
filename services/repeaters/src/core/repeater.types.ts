import { RepeaterAuth } from './auth.types';

export type RepeaterCode = 'SUTRAN' | 'UNIGIS' | 'OSINERGMIN' | 'WISETRACK' | string;

/**
 * Posición normalizada producida por el processor de ReplicaHub.
 * Los adaptadores NO reciben RAW de Wialon ni sockets TCP.
 */
export interface NormalizedPosition {
  messageId: string;
  positionId?: string;
  rawMessageId?: string;

  unitId: string;
  plate: string;
  imei?: string | null;
  clientId?: string;
  clientName?: string;

  eventTime: Date | string;
  receivedAt?: Date | string;

  latitude: number;
  longitude: number;
  speed?: number | null;
  course?: number | null;
  altitude?: number | null;
  satellites?: number | null;
  ignition?: boolean | null;

  /** Parámetros adicionales normalizados / IO del equipo. */
  parameters?: Record<string, unknown> | null;

  /** Evento explícito, cuando el processor ya lo haya determinado. */
  event?: string | null;
}

export interface RepeaterRuntimeConfig {
  repeaterId: string;
  code: RepeaterCode;
  name: string;
  endpointUrl: string;
  method?: 'POST' | 'PUT';
  timeoutMs: number;
  maxRetries: number;
  active: boolean;
  auth: RepeaterAuth;
  headers?: Record<string, string>;
  config?: Record<string, unknown>;
}

export type RepeaterResultStatus = 'SUCCESS' | 'REJECTED' | 'ERROR' | 'TIMEOUT';

export interface RepeaterSendResult<TPayload = unknown, TResponse = unknown> {
  status: RepeaterResultStatus;
  ok: boolean;
  retryable: boolean;

  httpStatus?: number;
  durationMs: number;

  payload: TPayload;
  response?: TResponse;
  responseText?: string;

  errorCode?: string;
  errorMessage?: string;
}

export interface RepeaterAdapter<TConfig extends RepeaterRuntimeConfig = RepeaterRuntimeConfig> {
  readonly code: RepeaterCode;

  validateConfig(config: TConfig): string[];

  send(
    position: NormalizedPosition,
    config: TConfig,
    signal?: AbortSignal,
  ): Promise<RepeaterSendResult>;

  sendBatch?(
    positions: NormalizedPosition[],
    config: TConfig,
    signal?: AbortSignal,
  ): Promise<RepeaterSendResult>;
}

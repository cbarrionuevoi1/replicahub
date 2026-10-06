import { SutranRuntimeConfig } from './sutran.types';

export const SUTRAN_DEFAULTS = {
  timeoutMs: 10_000,
  maxRetries: 3,
  batchSize: 1,
  maxBatchSize: 5_000,
  stopSpeedThreshold: 0,
  includeImei: true,
} as const;

/**
 * Manifiesto para que el backend/frontend puedan generar la pantalla de Ajustes.
 * El token es secreto y debe persistirse cifrado. Solo ADMIN debe poder modificarlo.
 */
export const SUTRAN_MANIFEST = {
  code: 'SUTRAN',
  displayName: 'SUTRAN',
  description: 'Replicación de posiciones GPS hacia el API de transmisiones de SUTRAN.',
  method: 'POST',
  auth: {
    type: 'TOKEN_HEADER',
    headerName: 'access-token',
    adminOnly: true,
    secretFields: [
      {
        key: 'token',
        label: 'Access token',
        masked: true,
        required: true,
      },
    ],
  },
  settings: [
    { key: 'endpointUrl', label: 'Endpoint', type: 'url', required: true, adminOnly: true },
    { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number', required: true, adminOnly: true },
    { key: 'maxRetries', label: 'Reintentos', type: 'number', required: true, adminOnly: true },
    { key: 'apiVersion', label: 'Versión API', type: 'select', options: ['v1', 'v2'], adminOnly: true },
    { key: 'batchSize', label: 'Tramas por petición', type: 'number', min: 1, max: 5000, adminOnly: true },
  ],
} as const;

export function withSutranDefaults(config: SutranRuntimeConfig): SutranRuntimeConfig {
  return {
    ...config,
    method: 'POST',
    timeoutMs: config.timeoutMs || SUTRAN_DEFAULTS.timeoutMs,
    maxRetries: Number.isFinite(config.maxRetries) ? config.maxRetries : SUTRAN_DEFAULTS.maxRetries,
    config: {
      apiVersion: 'v1',
      batchSize: SUTRAN_DEFAULTS.batchSize,
      stopSpeedThreshold: SUTRAN_DEFAULTS.stopSpeedThreshold,
      includeImei: SUTRAN_DEFAULTS.includeImei,
      ...(config.config ?? {}),
    },
  };
}

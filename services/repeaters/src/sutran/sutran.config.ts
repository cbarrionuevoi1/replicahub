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
 * Solo se solicita el token al usuario. Endpoint y parámetros técnicos se configuran internamente.
 * El token debe persistirse cifrado; solo ADMIN puede modificarlo.
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
        label: 'Token SUTRAN',
        masked: true,
        required: true,
      },
    ],
  },
  settings: [], // Sin campos técnicos en el formulario público.
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

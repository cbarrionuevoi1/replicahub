import { AppDataSource } from '../config/database';
import { Repeater } from '../entities/Repeater';
import { decryptSecret } from './repeater-secrets.service';
import { SUTRAN_DEFAULTS } from '@replicahub/repeaters';
import type { SutranRuntimeConfig } from '@replicahub/repeaters';

/** Solo para el dispatcher/worker (nunca usar como respuesta de la API). */
export async function getSutranRuntimeConfig(repeaterId: string): Promise<SutranRuntimeConfig> {
  const entity = await AppDataSource.getRepository(Repeater).findOneBy({ id: repeaterId, type: 'SUTRAN' });
  if (!entity) throw new Error('Repetidor SUTRAN no encontrado.');
  const endpointUrl = process.env.SUTRAN_ENDPOINT_URL?.trim();
  if (!endpointUrl) throw new Error('SUTRAN_ENDPOINT_URL no configurado en el backend.');
  if (new URL(endpointUrl).protocol !== 'https:') throw new Error('El endpoint SUTRAN debe usar HTTPS.');
  const encryptedToken = entity.auth?.tokenEncrypted;
  if (typeof encryptedToken !== 'string') throw new Error('Falta configurar el token SUTRAN.');
  return {
    repeaterId: entity.id,
    code: 'SUTRAN',
    name: entity.name,
    endpointUrl,
    method: 'POST',
    timeoutMs: SUTRAN_DEFAULTS.timeoutMs,
    maxRetries: SUTRAN_DEFAULTS.maxRetries,
    active: entity.active,
    auth: { type: 'TOKEN_HEADER', headerName: 'access-token', token: decryptSecret(encryptedToken) },
    config: { apiVersion: 'v1', batchSize: 1, includeImei: true, stopSpeedThreshold: 0 },
  };
}

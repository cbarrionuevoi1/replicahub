import { NormalizedPosition } from '../core/repeater.types';
import { SUTRAN_DEFAULTS } from './sutran.config';
import { SutranFrame, SutranRuntimeConfig } from './sutran.types';

const PLATE_REGEX = /^[A-Z][A-Z0-9]{5}$/;
const IMEI_REGEX = /^\d{15}$/;

export function normalizeSutranPlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateSutranConfig(config: SutranRuntimeConfig): string[] {
  const errors: string[] = [];

  if (!config.active) errors.push('El repetidor SUTRAN está inactivo.');

  try {
    const url = new URL(config.endpointUrl);
    if (url.protocol !== 'https:') {
      errors.push('El endpoint SUTRAN debe usar HTTPS.');
    }
  } catch {
    errors.push('endpointUrl no es una URL válida.');
  }

  if (config.auth?.type !== 'TOKEN_HEADER') {
    errors.push('SUTRAN requiere autenticación TOKEN_HEADER.');
  }

  if (!config.auth?.token?.trim()) {
    errors.push('El access-token de SUTRAN no está configurado.');
  }

  if ((config.auth?.headerName ?? '').toLowerCase() !== 'access-token') {
    errors.push('SUTRAN requiere enviar el token en el header access-token.');
  }

  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
    errors.push('timeoutMs debe ser mayor que 0.');
  }

  const batchSize = Number(config.config?.batchSize ?? SUTRAN_DEFAULTS.batchSize);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > SUTRAN_DEFAULTS.maxBatchSize) {
    errors.push(`batchSize debe estar entre 1 y ${SUTRAN_DEFAULTS.maxBatchSize}.`);
  }

  return errors;
}

export function validateNormalizedPositionForSutran(position: NormalizedPosition): string[] {
  const errors: string[] = [];
  const plate = normalizeSutranPlate(position.plate ?? '');

  if (!PLATE_REGEX.test(plate)) {
    errors.push('La placa SUTRAN debe tener 6 caracteres alfanuméricos, iniciar con letra y no contener guiones/espacios.');
  }

  if (!Number.isFinite(position.latitude) || position.latitude < -90 || position.latitude > 90) {
    errors.push('Latitud inválida.');
  }

  if (!Number.isFinite(position.longitude) || position.longitude < -180 || position.longitude > 180) {
    errors.push('Longitud inválida.');
  }

  if (position.imei && !IMEI_REGEX.test(String(position.imei))) {
    errors.push('El IMEI, si se envía, debe tener exactamente 15 dígitos.');
  }

  const eventTime = new Date(position.eventTime);
  if (Number.isNaN(eventTime.getTime())) {
    errors.push('eventTime inválido.');
  }

  return errors;
}

export function validateSutranFrame(frame: SutranFrame): string[] {
  const errors: string[] = [];

  if (!PLATE_REGEX.test(frame.plate)) errors.push('plate inválido.');
  if (!Array.isArray(frame.geo) || frame.geo.length !== 2) errors.push('geo debe ser [latitud,longitud].');
  if (!Number.isInteger(frame.direction) || frame.direction < 0 || frame.direction > 360) errors.push('direction debe ser un entero entre 0 y 360.');
  if (!['ER', 'PA', 'BP'].includes(frame.event)) errors.push('event debe ser ER, PA o BP.');
  if (!Number.isInteger(frame.speed) || frame.speed < 0) errors.push('speed debe ser un entero >= 0.');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(frame.time_device)) errors.push('time_device debe usar YYYY-MM-DD HH:mm:ss.');
  if (frame.imei && !IMEI_REGEX.test(frame.imei)) errors.push('imei debe tener 15 dígitos.');

  return errors;
}

import { NormalizedPosition } from '../core/repeater.types';
import { SUTRAN_DEFAULTS } from './sutran.config';
import { SutranEvent, SutranFrame, SutranRuntimeConfig } from './sutran.types';
import { normalizeSutranPlate, validateNormalizedPositionForSutran, validateSutranFrame } from './sutran.validator';

function formatPeruDateTime(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('eventTime inválido.');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function toDirection(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(Number(value));
  return Math.min(360, Math.max(0, rounded));
}

function toSpeed(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(Number(value)));
}

function booleanish(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value === 'string') {
    return ['true', 'yes', 'on', 'panic', 'bp'].includes(value.toLowerCase());
  }
  return false;
}

function resolveSutranEvent(position: NormalizedPosition, config: SutranRuntimeConfig): SutranEvent {
  const explicit = String(position.event ?? '').toUpperCase();
  if (explicit === 'ER' || explicit === 'PA' || explicit === 'BP') return explicit;

  const eventParameterName = String(config.config?.eventParameterName ?? '');
  if (eventParameterName && position.parameters) {
    const candidate = String(position.parameters[eventParameterName] ?? '').toUpperCase();
    if (candidate === 'ER' || candidate === 'PA' || candidate === 'BP') return candidate;
  }

  const panicParameterName = String(config.config?.panicParameterName ?? 'panic');
  if (position.parameters && booleanish(position.parameters[panicParameterName])) return 'BP';

  const threshold = Number(config.config?.stopSpeedThreshold ?? SUTRAN_DEFAULTS.stopSpeedThreshold);
  const speed = toSpeed(position.speed);
  return speed <= threshold ? 'PA' : 'ER';
}

export function mapPositionToSutran(
  position: NormalizedPosition,
  config: SutranRuntimeConfig,
): SutranFrame {
  const sourceErrors = validateNormalizedPositionForSutran(position);
  if (sourceErrors.length > 0) {
    throw new Error(`Posición inválida para SUTRAN: ${sourceErrors.join(' ')}`);
  }

  const frame: SutranFrame = {
    plate: normalizeSutranPlate(position.plate),
    geo: [Number(position.latitude), Number(position.longitude)],
    direction: toDirection(position.course),
    event: resolveSutranEvent(position, config),
    speed: toSpeed(position.speed),
    time_device: formatPeruDateTime(position.eventTime),
  };

  const includeImei = config.config?.includeImei !== false;
  if (includeImei && position.imei) {
    frame.imei = String(position.imei);
  }

  const frameErrors = validateSutranFrame(frame);
  if (frameErrors.length > 0) {
    throw new Error(`Trama SUTRAN inválida: ${frameErrors.join(' ')}`);
  }

  return frame;
}

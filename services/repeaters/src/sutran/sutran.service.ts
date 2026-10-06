import { HttpTimeoutError, fetchWithTimeout, isRetryableHttpStatus, readResponseBody } from '../core/http';
import {
  NormalizedPosition,
  RepeaterAdapter,
  RepeaterSendResult,
} from '../core/repeater.types';
import { SUTRAN_DEFAULTS, withSutranDefaults } from './sutran.config';
import { mapPositionToSutran } from './sutran.mapper';
import { SutranFrame, SutranResponseLike, SutranRuntimeConfig } from './sutran.types';
import { validateSutranConfig } from './sutran.validator';

function sutranResponseIndicatesFailure(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const value = body as SutranResponseLike;

  const status = Number(value.status ?? value.code);
  if (Number.isFinite(status) && status >= 400) return true;

  return false;
}

function responseErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const value = body as SutranResponseLike;
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.result === 'string' && value.result.trim()) return value.result;
  }
  return fallback;
}

export class SutranService implements RepeaterAdapter<SutranRuntimeConfig> {
  readonly code = 'SUTRAN' as const;

  validateConfig(config: SutranRuntimeConfig): string[] {
    return validateSutranConfig(withSutranDefaults(config));
  }

  async send(
    position: NormalizedPosition,
    config: SutranRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<RepeaterSendResult<SutranFrame[], unknown>> {
    return this.sendBatch([position], config, signal);
  }

  async sendBatch(
    positions: NormalizedPosition[],
    rawConfig: SutranRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<RepeaterSendResult<SutranFrame[], unknown>> {
    const config = withSutranDefaults(rawConfig);
    const startedAt = Date.now();

    const configErrors = this.validateConfig(config);
    if (configErrors.length > 0) {
      return {
        status: 'ERROR',
        ok: false,
        retryable: false,
        durationMs: Date.now() - startedAt,
        payload: [],
        errorCode: 'INVALID_CONFIG',
        errorMessage: configErrors.join(' '),
      };
    }

    if (positions.length === 0) {
      return {
        status: 'ERROR',
        ok: false,
        retryable: false,
        durationMs: Date.now() - startedAt,
        payload: [],
        errorCode: 'EMPTY_BATCH',
        errorMessage: 'No hay posiciones para enviar a SUTRAN.',
      };
    }

    if (positions.length > SUTRAN_DEFAULTS.maxBatchSize) {
      return {
        status: 'ERROR',
        ok: false,
        retryable: false,
        durationMs: Date.now() - startedAt,
        payload: [],
        errorCode: 'BATCH_TOO_LARGE',
        errorMessage: `SUTRAN admite como máximo ${SUTRAN_DEFAULTS.maxBatchSize} tramas por petición en API v2.`,
      };
    }

    let payload: SutranFrame[];
    try {
      payload = positions.map((position) => mapPositionToSutran(position, config));
    } catch (error) {
      return {
        status: 'REJECTED',
        ok: false,
        retryable: false,
        durationMs: Date.now() - startedAt,
        payload: [],
        errorCode: 'INVALID_PAYLOAD',
        errorMessage: error instanceof Error ? error.message : 'No se pudo construir la trama SUTRAN.',
      };
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(config.headers ?? {}),
      'access-token': config.auth.token,
    };

    try {
      const response = await fetchWithTimeout(
        config.endpointUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        config.timeoutMs,
        signal,
      );

      const body = await readResponseBody(response);
      const rejectedByBody = sutranResponseIndicatesFailure(body.data);
      const ok = response.ok && !rejectedByBody;

      if (ok) {
        return {
          status: 'SUCCESS',
          ok: true,
          retryable: false,
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          payload,
          response: body.data,
          responseText: body.text,
        };
      }

      return {
        status: 'REJECTED',
        ok: false,
        retryable: isRetryableHttpStatus(response.status),
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
        payload,
        response: body.data,
        responseText: body.text,
        errorCode: `HTTP_${response.status}`,
        errorMessage: responseErrorMessage(body.data, `SUTRAN respondió HTTP ${response.status}.`),
      };
    } catch (error) {
      if (error instanceof HttpTimeoutError) {
        return {
          status: 'TIMEOUT',
          ok: false,
          retryable: true,
          durationMs: Date.now() - startedAt,
          payload,
          errorCode: 'ETIMEDOUT',
          errorMessage: error.message,
        };
      }

      return {
        status: 'ERROR',
        ok: false,
        retryable: true,
        durationMs: Date.now() - startedAt,
        payload,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Error de red al enviar a SUTRAN.',
      };
    }
  }
}

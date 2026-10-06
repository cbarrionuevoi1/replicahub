# ReplicaHub - Repeaters

Paquete independiente para adaptadores de destinos externos de ReplicaHub.

## Regla arquitectónica

Este paquete **no recibe sockets TCP ni RAW de Wialon** y **no conoce PostgreSQL**.

Recibe una `NormalizedPosition` desde el dispatcher y una configuración de runtime ya resuelta (incluidos secretos descifrados), transforma la posición al formato del destino, valida, envía y devuelve un resultado estándar.

```text
receiver -> processor -> dispatcher -> queue -> repeaters/SUTRAN -> API SUTRAN
```

## SUTRAN implementado

La implementación contempla:

- POST JSON.
- Header `access-token` directo, sin `Authorization: Bearer`.
- Placa SUTRAN en 6 caracteres alfanuméricos, sin guion ni espacios.
- `geo` como `[latitud, longitud]`.
- `direction` entero 0..360.
- `event`: `ER`, `PA` o `BP`.
- `speed` entero km/h.
- `time_device` en `YYYY-MM-DD HH:mm:ss` con zona `America/Lima` (UTC-5).
- IMEI opcional de 15 dígitos.
- Timeout.
- Clasificación de errores reintentables.
- Envío individual y por lote (hasta 5000 para API v2).
- No expone el token en el resultado.

## Configuración esperada

```ts
const config = {
  repeaterId: 'uuid-repeater',
  code: 'SUTRAN',
  name: 'SUTRAN',
  endpointUrl: 'https://ws03.sutran.gob.pe/...',
  method: 'POST',
  timeoutMs: 10000,
  maxRetries: 3,
  active: true,
  auth: {
    type: 'TOKEN_HEADER',
    headerName: 'access-token',
    token: 'TOKEN-DESENCRIPTADO-EN-RUNTIME'
  },
  config: {
    apiVersion: 'v2',
    batchSize: 1,
    includeImei: true,
    stopSpeedThreshold: 0,
    panicParameterName: 'panic'
  }
};
```

## Seguridad

El token **no debe estar hardcodeado** aquí ni en variables públicas del frontend.

Flujo esperado:

```text
ADMIN -> Ajustes del repetidor -> backend -> cifrado -> repeater_secrets
                                               |
                                               v
                                   dispatcher descifra en runtime
                                               |
                                               v
                                      SutranService
```

El OPERATOR puede ver estado, asignaciones y transmisiones, pero no leer/modificar secretos ni URL crítica.

## Ejemplo de uso

```ts
import { SutranService } from '@replicahub/repeaters';

const sutran = new SutranService();
const result = await sutran.send(position, config);

if (!result.ok && result.retryable) {
  // El dispatcher/worker decide el reintento.
}
```

## Importante

Los reintentos no se ejecutan dentro de `SutranService`. El adaptador solamente informa `retryable`.
La política de backoff/reintentos debe pertenecer a la cola/worker del dispatcher para mantener la separación de responsabilidades.

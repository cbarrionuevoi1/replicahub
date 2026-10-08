# ReplicaHub — Revisión lógica 08/10/2026

## Estado real

Se corrigió el flujo TCP Wialon → PostgreSQL (RAW + posición) → cursor del despachador → transmissions → worker → adaptador SUTRAN → API destino → estado, HTTP y respuesta.

**Solo SUTRAN tiene un adaptador de envío implementado** en este repositorio. No existe todavía envío operativo a OSINERGMIN, UNIGIS o WISETRACK, aunque estén mencionados en los tipos. Ni el dashboard ni la documentación deben confundir estos protocolos futuros con integraciones ya operativas.

**No se ha podido verificar una entrega real a SUTRAN ni aplicar migraciones a tu base de datos** desde este entorno: faltan la instancia PostgreSQL/credenciales reales, dependencias instaladas y autorización del endpoint de destino. Los tests HTTP usan una respuesta simulada para no enviar datos al tercero.

## Instalación y verificación local (Windows, PowerShell)

Desde `C:\Users\Usuario\Desktop\Replica` (o la carpeta en la que descomprimas el proyecto):

1. Respaldar primero la base de datos existente: `pg_dump -Fc -h localhost -U postgres -d replicahub -f replicahub_backup.dump` (ajustar usuario/host/puerto). No restaurar sobre producción sin comprobar el backup.
2. Iniciar PostgreSQL 16 local, por ejemplo `docker compose up -d` si Docker está instalado, o usar el PostgreSQL que ya tienes.
3. Crear `backend/.env`, `services/wialon-push/.env` y `services/push-replicas/.env` copiando sus respectivos `.env.example`. Configurar la misma conexión a PostgreSQL en los tres. Configurar `JWT_SECRET` seguro, `TZ=UTC` y `REPEATER_ENCRYPTION_KEY` **igual** en backend y push-replicas. Generar una clave de cifrado de 64 hex con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; **guardar la clave y no regenerarla** si ya existen tokens cifrados.
4. Configurar `SUTRAN_ENDPOINT_URL` HTTPS real en backend y push-replicas. En el panel, el administrador debe crear el repetidor SUTRAN y guardar el token. El ID Wialon debe coincidir con `units.wialonUniqueId` o `units.imei` y la unidad debe tener placa, IMEI y asignación activa al repetidor.
5. Compilar la dependencia compartida primero:
   ```powershell
   cd services\repeaters
   npm ci
   npm run build
   ```
6. Preparar el backend y **ejecutar las migraciones** (necesarias para columnas nuevas y los índices de idempotencia):
   ```powershell
   cd ..\..\backend
   npm ci
   npm run migration:run
   npm run start
   ```
   El backend escucha en `http://localhost:4000`. Si no tienes usuario administrador, configura `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` (mínimo 12 caracteres) en `backend/.env`; abre otra terminal y ejecuta `npm run create-admin`. El script ya no permite contraseñas por defecto.
7. Iniciar receptor TCP y confirmar en sus logs que arranca puerto 5000:
   ```powershell
   cd services\wialon-push
   npm ci
   npm run build
   npm start
   ```
8. Iniciar worker y despacho:
   ```powershell
   cd services\push-replicas
   npm ci
   npm run build
   npm start
   ```
9. Iniciar panel:
   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```
   Configurar `frontend/.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:4000` y entrar a `http://localhost:3000`.

**Modo de envío:** el worker es conservador: simula mientras `DRY_RUN` no sea exactamente `false`. Para enviar realmente, colocar `DRY_RUN=false` en `services/push-replicas/.env` y **reiniciar el worker**. No es necesario recompilar por cambiar solo el `.env`. En PM2, reiniciar `service-push-replicas` desde su directorio; la configuración PM2 ya no impone `DRY_RUN=true`.

Una transmisión con estado `SIMULATED` **no se envía automáticamente** al cambiar a `DRY_RUN=false`: usa **Reprocesar** en Transmisiones, que pregunta antes de ponerla nuevamente en cola. `SENT` significa aceptación HTTP exitosa con cuerpo no rechazado; la confirmación funcional final depende de la API real y del proveedor.

## Verificación SQL (no ejecutar INSERT/UPDATE manualmente)

```sql
SELECT COUNT(*) AS raw FROM raw_messages;
SELECT COUNT(*) AS positions FROM positions;
SELECT status, COUNT(*) FROM transmissions GROUP BY status ORDER BY status;
SELECT imei, status, "unitId", "receivedAt" FROM raw_messages ORDER BY "receivedAt" DESC LIMIT 10;
SELECT plate, "repeaterName", status, "httpCode", error, attempts, "nextAttemptAt"
  FROM transmissions ORDER BY "createdAt" DESC LIMIT 20;
SELECT * FROM service_cursors WHERE id = 'dispatcher';
```

Si hay RAW pero no posiciones, revisar si llegó el bloque `posinfo`. Si hay posiciones pero no transmisiones, revisar identificación UID/IMEI, placa, estado de unidad, repetidor y asignaciones; también revisar el cursor. Si hay fallos `INVALID_CONFIG`, revisar HTTPS y token. Si hay `401/403`, revisar credencial/permitidos en SUTRAN. Si hay `429/500/503/ETIMEDOUT`, el worker reintenta con backoff y número máximo configurado. El worker no envía protocolos sin adaptador.

## Cambios de integridad

- ACK TCP solo después de confirmar transacción RAW + posición.
- `messageHash` SHA-256 evita duplicar un paquete Wialon idéntico cuando se repite por falta de ACK. La unicidad aplica a datos nuevos; las filas antiguas siguen intactas.
- Cursor por `(receivedAt, position.id)` evita perder posiciones con idéntico tiempo y usa posiciones antes de hacer JOIN a repetidores.
- Índice único `(positionId,repeaterId)` evita duplicar trabajos nuevos; **si ya había transmisiones duplicadas** debes resolverlas antes de aplicar esta migración (PostgreSQL informará que el índice único no se puede crear). No se borran registros automáticamente.
- Reintentos atómicos entre workers, con plazo de recuperación tras falla de proceso. Se registra petición, respuesta, errores e intentos. Es una entrega **al menos una vez**: si se corta el worker después de recibir HTTP 200 pero antes de guardar estado, una recuperación podría reenviar; exigir idempotencia en el receptor para garantía más fuerte.
- Al asociar una unidad pendiente con `updateHistorical=true`, se generan explícitamente trabajos para las posiciones históricas elegibles que estaban fuera del cursor.
- Se mantienen **únicamente dos roles**: `ADMIN` y `OPERATOR`.

## Tests y limitaciones

Tras `npm run build` de `services/repeaters`:

```powershell
node --test services\repeaters\tests-sutran.js
```

El archivo `services/push-replicas/tests-worker.js` cubre el descifrado AES-256-GCM, `SENT`, `RETRY` y `SIMULATED` utilizando un PostgreSQL simulado. Para ejecutarlo localmente también se requiere `ts-node` y una compilación de repeaters. No reemplaza pruebas de integración reales.

Antes de la migración, también puedes revisar posibles duplicados que bloquearían los nuevos índices únicos:

```sql
SELECT "positionId", "repeaterId", COUNT(*) FROM transmissions
 WHERE "positionId" IS NOT NULL GROUP BY "positionId", "repeaterId" HAVING COUNT(*) > 1;
SELECT imei, COUNT(*) FROM detected_units GROUP BY imei HAVING COUNT(*) > 1;
```

**Se recomienda realizar un piloto con una sola placa** y verificar en la API SUTRAN una recepción real antes de activar toda la flota. Comprueba hora, coordenadas, eventos, token, respuesta de negocio, duplicados e índice de aceptación.

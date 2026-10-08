import net from 'net';
import { createHash } from 'crypto';
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { decodeWialonPayload } from './decoder';

dotenv.config();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PACKET = Number(process.env.MAX_PACKET_BYTES || 1024 * 1024);
const MAX_BUFFER = Number(process.env.MAX_BUFFER_BYTES || 16 * 1024 * 1024);
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'replicahub',
});

async function identifyUnit(db: PoolClient, uid: string): Promise<{ id: string; clientId: string | null } | null> {
  const result = await db.query(`
    SELECT id, "clientId" FROM units
    WHERE "wialonUniqueId" = $1 OR imei = $1
    ORDER BY CASE WHEN "wialonUniqueId" = $1 THEN 0 ELSE 1 END
    LIMIT 2
  `, [uid]);
  // IDs ambiguos, incluso si coinciden vía distintas columnas, nunca se asignan por azar.
  return result.rows.length === 1 ? result.rows[0] : null;
}

async function processPacket(payload: Buffer, ip: string): Promise<void> {
  const { uid, time, posinfo, decodedData } = decodeWialonPayload(payload);
  const messageHash = createHash('sha256').update(payload).digest('hex');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const unit = await identifyUnit(db, uid);
    const raw = await db.query(`
      INSERT INTO raw_messages (imei, "rawData", "receivedAt", "ipAddress", "unitId", "clientId", status, "decodedData", "messageHash")
      VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("messageHash") WHERE "messageHash" IS NOT NULL DO NOTHING RETURNING id
    `, [uid, payload.toString('hex'), ip, unit?.id ?? null, unit?.clientId ?? null,
        unit ? 'PROCESSED' : 'UNIDENTIFIED', JSON.stringify(decodedData), messageHash]);
    if (!raw.rows.length) {
      await db.query('COMMIT'); // paquete ya almacenado; se confirma nuevamente con ACK
      return;
    }

    if (posinfo) {
      await db.query(`
        INSERT INTO positions (
          "unitId", "rawMessageId", imei, latitude, longitude, speed, heading, altitude,
          satellites, "eventTime", "receivedAt", "rawData"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
      `, [unit?.id ?? null, raw.rows[0].id, uid, posinfo.latitude, posinfo.longitude,
          posinfo.speed, posinfo.course, posinfo.altitude, posinfo.satellites,
          new Date(time * 1000), JSON.stringify(decodedData)]);
    }
    if (unit) {
      await db.query(`
        UPDATE units SET "lastTransmissionAt" = NOW(),
          "firstTransmissionAt" = COALESCE("firstTransmissionAt", NOW()) WHERE id = $1
      `, [unit.id]);
    } else {
      // Seguimiento acumulado para mostrar nuevos IDs Wialon.
      await db.query(`
        INSERT INTO detected_units (imei, "firstSeenAt", "lastSeenAt", "totalMessages", linked)
        VALUES ($1, NOW(), NOW(), 1, FALSE)
        ON CONFLICT (imei) DO UPDATE SET "lastSeenAt" = NOW(),
          "totalMessages" = detected_units."totalMessages" + 1
      `, [uid]);
    }
    await db.query('COMMIT');
    console.log(`[TCP] ${uid}: ${unit ? 'identificada' : 'sin asociar'}; posición: ${!!posinfo}`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

const server = net.createServer(socket => {
  console.log(`[TCP] Conexión ${socket.remoteAddress}:${socket.remotePort}`);
  let buffer = Buffer.alloc(0);
  let chain = Promise.resolve();
  let closed = false;
  socket.setTimeout(120000);
  socket.on('timeout', () => socket.destroy());
  socket.on('error', err => console.error('[TCP] Socket:', err.message));
  socket.on('close', () => { closed = true; });

  socket.on('data', chunk => {
    // Backpressure: los ACK se envían solo DESPUÉS de escribir todo el paquete en DB.
    // Los callbacks 'data' no deben procesar el mismo buffer simultáneamente.
    socket.pause();
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > MAX_BUFFER) {
      console.error('[TCP] Se excedió el buffer máximo.');
      socket.destroy();
      return;
    }
    chain = chain.then(async () => {
      while (!closed && buffer.length >= 4) {
        const size = buffer.readInt32LE(0);
        if (size < 0 || size > MAX_PACKET) throw new Error(`Tamaño de trama inválido: ${size}`);
        if (size === 0) {
          buffer = buffer.subarray(4);
          socket.write(Buffer.from([0x11]));
          continue;
        }
        if (buffer.length < size + 4) break;
        const packet = buffer.subarray(4, size + 4);
        buffer = buffer.subarray(size + 4);
        await processPacket(packet, socket.remoteAddress || 'unknown');
        if (!closed) socket.write(Buffer.from([0x11]));
      }
      if (!closed) socket.resume();
    }).catch(error => {
      console.error('[TCP] Falló la persistencia/decodificación; sin ACK:', error);
      socket.destroy();
    });
  });
});

pool.query('SELECT 1').then(() => {
  server.listen(PORT, HOST, () => console.log(`[TCP] Receptor Wialon ${HOST}:${PORT}`));
}).catch(error => {
  console.error('[TCP] No se pudo conectar a PostgreSQL:', error);
  process.exitCode = 1;
  void pool.end();
});

process.on('SIGTERM', () => {
  server.close();
  void pool.end();
});

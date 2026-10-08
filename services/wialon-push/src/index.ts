import net from 'net';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { decodeWialonPayload } from './decoder';

// Load .env from current directory in production
dotenv.config();

const PORT = 5000;
const HOST = '0.0.0.0';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'replicahub',
});

// Helper to find unit by Wialon ID or IMEI
async function identifyUnit(identifier: string) {
  // First attempt: Exact match by wialonUniqueId
  const wialonQuery = `SELECT id, "clientId" FROM units WHERE "wialonUniqueId" = $1`;
  const wialonRes = await pool.query(wialonQuery, [identifier]);

  if (wialonRes.rows.length === 1) {
    return wialonRes.rows[0];
  } else if (wialonRes.rows.length > 1) {
    // Ambiguous wialonUniqueId match! Don't arbitrarily assign.
    return null;
  }

  // Second attempt: Exact match by IMEI
  const imeiQuery = `SELECT id, "clientId" FROM units WHERE "imei" = $1`;
  const imeiRes = await pool.query(imeiQuery, [identifier]);

  if (imeiRes.rows.length === 1) {
    return imeiRes.rows[0];
  }

  // Unidentified or ambiguous
  return null;
}

const server = net.createServer((socket) => {
  console.log(`[TCP] New connection from ${socket.remoteAddress}:${socket.remotePort}`);
  
  let buffer = Buffer.alloc(0);

  socket.on('data', async (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length >= 4) {
      // Wialon Retranslator packet size is a 32-bit integer (little endian)
      const packetSize = buffer.readInt32LE(0);
      
      // If packet size is 0 (ping), Wialon expects an ACK (0x11) too
      if (packetSize === 0) {
        socket.write(Buffer.from([0x11]));
        buffer = buffer.subarray(4);
        continue;
      }

      // Check if we have the full packet (4 bytes header + packetSize bytes payload)
      if (buffer.length < 4 + packetSize) {
        break; // Wait for more data
      }

      const payload = buffer.subarray(4, 4 + packetSize);
      buffer = buffer.subarray(4 + packetSize);

      // Enforce exact length check before decoding (payload.length MUST exactly equal packetSize)
      if (payload.length !== packetSize) {
         console.error(`[TCP] Payload length mismatch. Declared: ${packetSize}, Actual: ${payload.length}`);
         socket.destroy();
         break;
      }

      try {
        await processPacket(payload, socket.remoteAddress || 'unknown');
        // Send ACK
        socket.write(Buffer.from([0x11]));
      } catch (err) {
        console.error(`[TCP] Error processing packet:`, err);
        // Do NOT send ACK on error. Drop the connection so Wialon retransmits safely.
        socket.destroy();
      }
    }
  });

  socket.setTimeout(120000); // 120s timeout
  socket.on('timeout', () => {
    console.log(`[TCP] Connection timeout from ${socket.remoteAddress}`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error(`[TCP] Socket error from ${socket.remoteAddress}:`, err);
  });

  socket.on('close', () => {
    console.log(`[TCP] Connection closed from ${socket.remoteAddress}`);
  });
});

async function processPacket(payload: Buffer, ipAddress: string) {
  // Decode the packet
  const { uid, time, flags, decodedData, posinfo } = decodeWialonPayload(payload);

  const rawHex = payload.toString('hex');
  const unit = await identifyUnit(uid);
  const status = unit ? 'PROCESSED' : 'UNIDENTIFIED';

  // 1. Insert Raw Message
  const rawMsgQuery = `
    INSERT INTO raw_messages (imei, "rawData", "receivedAt", "ipAddress", "unitId", "clientId", status, "decodedData")
    VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
    RETURNING id
  `;
  const rawMsgValues = [
    uid,
    rawHex,
    ipAddress,
    unit ? unit.id : null,
    unit ? unit.clientId : null,
    status,
    JSON.stringify(decodedData)
  ];
  const res = await pool.query(rawMsgQuery, rawMsgValues);

  // 2. Insert Position if posinfo exists
  if (posinfo) {
    const eventTime = new Date(time * 1000);
    const posQuery = `
      INSERT INTO positions (
        "unitId", imei, latitude, longitude, speed, heading, altitude, satellites, "eventTime", "receivedAt", "rawData"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    `;
    const posValues = [
      unit ? unit.id : null,
      uid,
      posinfo.latitude,
      posinfo.longitude,
      posinfo.speed,
      posinfo.course,
      posinfo.altitude,
      posinfo.satellites,
      eventTime,
      JSON.stringify(decodedData)
    ];
    await pool.query(posQuery, posValues);
  }

  console.log(`[TCP] Processed packet for UID: ${uid} | Status: ${status} | Blocks: ${decodedData.blocks.length}`);
}

server.listen(PORT, HOST, () => {
  console.log(`[TCP] Wialon Push Receiver listening on ${HOST}:${PORT}`);
});

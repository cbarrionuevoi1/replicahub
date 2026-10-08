import { decodeWialonPayload } from './decoder';

// Wialon hex packet example exactly matching 120 bytes (4 bytes length + 116 bytes payload)
// Payload includes: UID, Time, Flags, Block 1 (posinfo), Block 2 (pwr_ext = 27.593), Block 3 (param0)
const fullHex = '74000000333533393736303133343435343835004B0BFB70000000030BBB000000270102706F73696E666F00A027AFDF5D9848403AC7253383DD4B400000000000805A40003601460B0BBB0000001200047077725F657874002B8716D9CE973B400BBB000000110004706172616D30000000000000000000';

const buffer = Buffer.from(fullHex, 'hex');
console.log("Full Packet Length:", buffer.length); // Should be 120

const packetSize = buffer.readInt32LE(0);
console.log("Declared Payload Size (packetSize):", packetSize); // Should be 116

if (buffer.length < 4 + packetSize) {
  console.error("Packet is incomplete!");
  process.exit(1);
}

const payload = buffer.subarray(4, 4 + packetSize);

if (payload.length !== packetSize) {
  console.error(`Payload length mismatch. Declared: ${packetSize}, Actual: ${payload.length}`);
  process.exit(1);
}

try {
  const result = decodeWialonPayload(payload);
  console.log("Decoded Successfully:");
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Decode Error:", err);
}

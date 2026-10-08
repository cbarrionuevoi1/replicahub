export function decodeWialonPayload(payload: Buffer) {
  let offset = 0;
  
  // Read Controller ID (null terminated string)
  let uidEnd = offset;
  while (uidEnd < payload.length && payload[uidEnd] !== 0x00) {
    uidEnd++;
  }
  const uid = payload.toString('ascii', offset, uidEnd);
  if (uidEnd === payload.length || !uid) throw new Error('Identificador Wialon vacío o sin terminador NUL');
  offset = uidEnd + 1; // skip null byte

  if (offset + 8 > payload.length) {
    throw new Error('Packet too short to contain time and flags');
  }

  // Time (Unix timestamp, 32-bit int, Big Endian)
  const time = payload.readInt32BE(offset);
  offset += 4;

  // Flags (32-bit int, Big Endian)
  const flags = payload.readInt32BE(offset);
  offset += 4;

  let decodedData: any = { time, flags, blocks: [] };
  let posinfo: any = null;

  // Read blocks
  while (offset < payload.length) {
    if (offset + 6 > payload.length) throw new Error('Bloque Wialon incompleto');
    
    // Block type (2 bytes, Big Endian)
    const blockType = payload.readUInt16BE(offset);
    offset += 2;

    // Block size (4 bytes, Big Endian)
    const blockSize = payload.readInt32BE(offset);
    offset += 4;

    if (blockSize < 3 || offset + blockSize > payload.length) throw new Error('Tamaño de bloque Wialon inválido');

    const blockStart = offset;
    const stealth = payload.readUInt8(offset);
    offset += 1;

    const dataType = payload.readUInt8(offset);
    offset += 1;

    // Block name (null terminated string)
    let nameEnd = offset;
    while (nameEnd < blockStart + blockSize && payload[nameEnd] !== 0x00) {
      nameEnd++;
    }
    if (nameEnd === blockStart + blockSize) throw new Error('Nombre de bloque sin terminador NUL');
    const blockName = payload.toString('ascii', offset, nameEnd);
    offset = nameEnd + 1;

    let blockValue: any = null;
    const valueSize = blockSize - (offset - blockStart);
    
    if (valueSize > 0) {
      const dataBuf = payload.subarray(offset, offset + valueSize);
      
      if (dataType === 1) { // Text
        // May have trailing null byte
        let textEnd = 0;
        while (textEnd < dataBuf.length && dataBuf[textEnd] !== 0x00) {
          textEnd++;
        }
        blockValue = dataBuf.toString('utf8', 0, textEnd);
      } else if (dataType === 2) { // Binary
        if (blockName === 'posinfo' && dataBuf.length >= 29) {
          posinfo = {
            longitude: dataBuf.readDoubleLE(0),
            latitude: dataBuf.readDoubleLE(8),
            altitude: dataBuf.readDoubleLE(16),
            speed: dataBuf.readInt16BE(24),
            course: dataBuf.readInt16BE(26),
            satellites: dataBuf.readUInt8(28)
          };
          if (![posinfo.latitude, posinfo.longitude, posinfo.speed, posinfo.course, posinfo.altitude].every(Number.isFinite) ||
              Math.abs(posinfo.latitude) > 90 || Math.abs(posinfo.longitude) > 180) {
            throw new Error('Coordenadas/valores GPS inválidos');
          }
          blockValue = posinfo;
        } else {
          blockValue = dataBuf.toString('hex');
        }
      } else if (dataType === 3) { // Int32
        if (dataBuf.length >= 4) blockValue = dataBuf.readInt32BE(0);
      } else if (dataType === 4) { // Double
        if (dataBuf.length >= 8) blockValue = dataBuf.readDoubleLE(0);
      } else if (dataType === 5) { // Int64
        if (dataBuf.length >= 8) blockValue = dataBuf.readBigInt64BE(0).toString();
      } else {
        blockValue = dataBuf.toString('hex');
      }
    }
    
    offset = blockStart + blockSize;
    decodedData.blocks.push({ name: blockName, type: dataType, value: blockValue, stealth });
  }

  if (time <= 0) throw new Error('Timestamp Wialon inválido');
  return { uid, time, flags, decodedData, posinfo };
}

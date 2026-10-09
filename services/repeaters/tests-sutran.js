const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SutranService, mapPositionToSutran } = require('./dist');
const service = new SutranService();
const config = {
  repeaterId: '1', code: 'SUTRAN', name: 'SUTRAN', endpointUrl: 'https://sutran.example.invalid/api',
  method: 'POST', timeoutMs: 1000, maxRetries: 3, active: true,
  auth: { type: 'TOKEN_HEADER', headerName: 'access-token', token: 'fake-token-for-tests' },
  config: { includeImei: true },
};
const position = {
  messageId: '1', unitId: 'u1', plate: 'F8F-912', imei: '353976013445485',
  latitude: -8.1102, longitude: -79.0301, speed: 35, course: 127,
  eventTime: '2026-10-08T16:00:00.000Z',
};
test('mapper convierte coordenadas, placa y hora Lima', () => {
  const frame = mapPositionToSutran(position, config);
  assert.equal(frame.plate, 'F8F912');
  assert.deepEqual(frame.geo, [-8.1102, -79.0301]);
  assert.equal(frame.time_device, '2026-10-08 11:00:00');
  assert.equal(frame.event, 'ER');
});
test('adaptador POST usa token cifrado previamente descifrado y confirma éxito', async () => {
  const previous = global.fetch;
  let called = false;
  global.fetch = async (url, init) => {
    called = true;
    assert.equal(url, config.endpointUrl);
    assert.equal(init.headers['access-token'], 'fake-token-for-tests');
    assert.equal(JSON.parse(init.body)[0].plate, 'F8F912');
    return new Response(JSON.stringify({ status: 200 }), { status: 200 });
  };
  try {
    const result = await service.send(position, config);
    assert.ok(called);
    assert.equal(result.ok, true);
    assert.equal(result.httpStatus, 200);
  } finally { global.fetch = previous; }
});
test('respuesta HTTP 500 es reintentable', async () => {
  const previous = global.fetch;
  global.fetch = async () => new Response('error', {status: 500});
  try { const r = await service.send(position, config); assert.equal(r.ok, false); assert.equal(r.retryable, true); }
  finally { global.fetch = previous; }
});
test('no se envia si la placa invalida', async () => {
  const result = await service.send({ ...position, plate: '-' }, config);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'INVALID_PAYLOAD');
});

test('HTTP 200 con rechazo en el JSON no se registra como enviado', async () => {
  const previous = global.fetch;
  global.fetch = async () => new Response('{"success":false,"error":"IP no autorizada"}', {status: 200});
  try {
    const r = await service.send(position, config);
    assert.equal(r.ok, false);
    assert.equal(r.httpStatus, 200);
    assert.match(r.errorMessage, /IP no autorizada/);
  } finally { global.fetch = previous; }
});

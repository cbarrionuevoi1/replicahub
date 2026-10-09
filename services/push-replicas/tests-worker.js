// Pruebas offline: no se envían peticiones reales a SUTRAN.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@replicahub/repeaters') return originalLoad.call(this, path.resolve(__dirname,'../repeaters/dist'), parent, isMain);
  return originalLoad.apply(this, arguments);
};
const { Worker, decryptRepeaterToken } = require('./dist/worker.js');
Module._load = originalLoad;
const secret = crypto.randomBytes(32);
process.env.REPEATER_ENCRYPTION_KEY = secret.toString('hex');
function encrypt(value) {
  const iv=crypto.randomBytes(12), c=crypto.createCipheriv('aes-256-gcm', secret, iv);
  const ct=Buffer.concat([c.update(value,'utf8'),c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}
const encryptedToken = encrypt('my-test-token');
const repeater = {
  id:'r1',name:'Prueba SUTRAN',type:'SUTRAN',url:'https://sutran.example.invalid/api',
  active:true,assignmentActive:true,unitActive:true,timeout:1000,maxRetries:3,
  auth:{tokenEncrypted:encryptedToken},config:{apiVersion:'v1'}
};
function createPool() {
  const status = {updated:null, sql:''};
  return {
    status,
    query: async (sql, args) => {
      if (sql.includes('UPDATE transmissions t')) return {rows:[{
        id:'tx1',attempts:0,cycleAttempts:0,repeaterId:'r1',unitId:'u1',plate:'F8F-912',imei:'353976013445485',positionId:'p1',repeaterName:'Prueba SUTRAN'
      }]};
      if (sql.includes('FROM repeaters r')) return {rows:[repeater]};
      if (sql.includes('SELECT * FROM positions')) return {rows:[{
        id:'p1',latitude:-8.1,longitude:-79.0,speed:20,heading:100,
        altitude:0,satellites:12,eventTime:new Date('2026-10-08T17:00:00Z'),receivedAt:new Date('2026-10-08T17:00:01Z')
      }]};
      if (sql.includes('WITH updated AS')) {status.updated=args;status.sql=sql;return {rowCount:1};}
      throw new Error('unexpected query '+sql);
    }
  };
}
test('regresión PostgreSQL 42P08: el estado $1 tiene tipo explícito consistente', async () => {
  // El mock comprueba la sentencia enviada al driver. Una ejecución con
  // PostgreSQL real se valida posteriormente en el VPS.
  const old = global.fetch;
  global.fetch = async () => new Response('{"status":200}', {status:200});
  try {
    const pool = createPool();
    await new Worker(pool).poll();
    assert.equal(pool.status.updated[0], 'SENT');
    const sql = pool.status.sql;
    assert.equal((sql.match(/\$1::text\b/g) || []).length, 3,
      'UPDATE, CASE e INSERT deben tipar el mismo $1 como text');
    assert.doesNotMatch(sql, /\$1(?![0-9]|::text\b)/,
      'No debe quedar un $1 sin casteo explícito');
  } finally {global.fetch = old;}
});
test('el token se descifra con la clave compartida',()=> {
  assert.equal(decryptRepeaterToken(encryptedToken),'my-test-token');
});
test('envía POST real y registra SENT más el historial (aunque DRY_RUN heredado sea true)',async()=> {
  process.env.DRY_RUN='true'; const old=global.fetch;
  let called=0;
  global.fetch=async (_url,options)=> {
    called++;
    assert.equal(options.headers['access-token'],'my-test-token');
    return new Response('{"status":200}',{status:200});
  };
  try {
    const pool=createPool();await new Worker(pool).poll();
    assert.equal(called,1);
    assert.equal(pool.status.updated[0],'SENT');
    assert.equal(pool.status.updated[1],200);
    assert.equal(pool.status.updated[3],1);
    assert.match(pool.status.sql,/transmission_attempts/);
  } finally {global.fetch=old; delete process.env.DRY_RUN;}
});
test('HTTP 503 registra respuesta y RETRY para siguiente intento',async()=> {
  const old=global.fetch;
  global.fetch=async()=> new Response('server error',{status:503});
  try {
    const pool=createPool();await new Worker(pool).poll();
    assert.equal(pool.status.updated[0],'RETRY');
    assert.equal(pool.status.updated[1],503);
    assert.equal(pool.status.updated[5],JSON.stringify('server error'));
  } finally {global.fetch=old;}
});
test('HTTP 403 no se simula: queda FAILED y guarda la respuesta de rechazo',async()=> {
  const old=global.fetch;
  global.fetch=async()=> new Response('IP no autorizada',{status:403});
  try {
    const pool=createPool();await new Worker(pool).poll();
    assert.equal(pool.status.updated[0],'FAILED');
    assert.equal(pool.status.updated[1],403);
    assert.equal(pool.status.updated[5],JSON.stringify('IP no autorizada'));
  } finally {global.fetch=old;}
});
test('timeout de red guarda fallo sin respuesta HTTP',async()=> {
  const old=global.fetch;
  global.fetch=async()=> {throw new Error('ECONNRESET');};
  try {
    const pool=createPool();await new Worker(pool).poll();
    assert.equal(pool.status.updated[0],'RETRY');
    assert.equal(pool.status.updated[1],null);
  } finally {global.fetch=old;}
});

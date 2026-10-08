// Tests sin PostgreSQL real: valida la lógica de resultados del worker y el token AES-GCM.
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
const { Worker, decryptRepeaterToken } = require('./src/worker.ts');
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
  const status = {updated:null};
  return {
    status,
    query: async (sql, args) => {
      if (sql.includes('UPDATE transmissions t')) return {rows:[{
        id:'tx1',attempts:0,repeaterId:'r1',unitId:'u1',plate:'F8F-912',imei:'353976013445485',positionId:'p1',repeaterName:'Prueba SUTRAN'
      }]};
      if (sql.includes('FROM repeaters r')) return {rows:[repeater]};
      if (sql.includes('SELECT * FROM positions')) return {rows:[{
        id:'p1',latitude:-8.1,longitude:-79.0,speed:20,heading:100,
        altitude:0,satellites:12,eventTime:new Date('2026-10-08T17:00:00Z'),receivedAt:new Date('2026-10-08T17:00:01Z')
      }]};
      if (sql.includes('UPDATE transmissions SET status')) {status.updated=args;return {rowCount:1};}
      throw new Error('unexpected query '+sql);
    }
  };
}
test('el token se descifra con la clave compartida',()=> {
  assert.equal(decryptRepeaterToken(encryptedToken),'my-test-token');
});
test('DRY_RUN=false envía POST real y registra SENT',async()=> {
  process.env.DRY_RUN='false'; const old=global.fetch;
  global.fetch=async (_url,options)=> {
    assert.equal(options.headers['access-token'],'my-test-token');
    return new Response('{"status":200}',{status:200});
  };
  try {
    const pool=createPool();await new Worker(pool).poll();
    assert.equal(pool.status.updated[0],'SENT');
    assert.equal(pool.status.updated[1],200);
    assert.equal(pool.status.updated[3],1);
  } finally {global.fetch=old;}
});
test('HTTP 503 marca RETRY, no SENT',async()=> {
  process.env.DRY_RUN='false';const old=global.fetch;
  global.fetch=async()=> new Response('server error',{status:503});
  try {const pool=createPool();await new Worker(pool).poll();
    assert.equal(pool.status.updated[0],'RETRY');
    assert.equal(pool.status.updated[1],503);
  } finally {global.fetch=old;}
});
test('DRY_RUN=true no llama API y marca SIMULATED',async()=> {
  process.env.DRY_RUN='true';const old=global.fetch;
  global.fetch=async()=> {throw new Error('No se debería llamar al servidor');};
  try {const pool=createPool();await new Worker(pool).poll();assert.equal(pool.status.updated[0],'SIMULATED');}
  finally {global.fetch=old;}
});

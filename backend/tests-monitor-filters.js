const {test} = require('node:test');
const assert = require('node:assert/strict');
const {transmissionFilters} = require('./dist/controllers/transmission-filters.js');
const req = query => ({query});
test('filtro por fechas aplica límites de inicio inclusivo y final exclusivo en hora Perú',()=>{
  const f = transmissionFilters(req({dateFrom:'2026-10-01',dateTo:'2026-10-09',dateField:'eventTime'}));
  assert.match(f.where,/t\."eventTime" >=/);
  assert.match(f.where, /::date \+ 1/);
  assert.match(f.where,/America\/Lima/);
  assert.deepEqual(f.params,['2026-10-01','2026-10-09']);
});
test('filtro de estado y placa son parametrizados',()=>{
  const f=transmissionFilters(req({status:'FAILED',search:"ABC%' OR 1=1 --"}));
  assert.match(f.where,/t\.status = \$1/);
  assert.ok(!f.where.includes('OR 1=1'));
  assert.equal(f.params.length,2);
});
test('se bloquean fechas inválidas y rangos inversos',()=>{
  assert.throws(()=>transmissionFilters(req({dateFrom:'2026-02-30'})),/inválido/);
  assert.throws(()=>transmissionFilters(req({dateFrom:'2026-10-10',dateTo:'2026-10-09'})),/inválido/);
  assert.throws(()=>transmissionFilters(req({dateField:'destroy_all'})),/inválido/);
});

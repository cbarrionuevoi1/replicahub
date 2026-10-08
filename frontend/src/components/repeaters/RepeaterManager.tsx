'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Check, ChevronRight, CircleAlert, Eye, EyeOff, KeyRound,
  Loader2, Plus, RadioTower, RefreshCw, Save, Search, ShieldCheck, Truck,
} from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

type Unit = { id: string; plate: string; alias: string | null; active: boolean };
type Repeater = {
  id: string; name: string; type: 'SUTRAN'; active: boolean; tokenConfigured: boolean;
  endpointConfigured: boolean; unitIds: string[]; createdAt: string;
};
type Transmission = { id: string; plate: string; status: string; httpCode?: number | null; eventTime: string | null; createdAt: string };
type Tab = 'resumen' | 'unidades' | 'transmisiones' | 'ajustes';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(`/api${path}`), {
    credentials: 'include', cache: 'no-store', ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data as T;
}

const inputClass = 'w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50';

export default function RepeaterManager() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>('resumen');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filterAll, setFilterAll] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [checkedAll, setCheckedAll] = useState<string[]>([]);
  const [checkedAssigned, setCheckedAssigned] = useState<string[]>([]);
  const [draftUnitIds, setDraftUnitIds] = useState<string[]>([]);
  const [name, setName] = useState('SUTRAN');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const selected = repeaters.find(r => r.id === selectedId) ?? null;

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [loadedRepeaters, loadedUnits] = await Promise.all([
        request<Repeater[]>('/repeaters'), request<Unit[]>('/repeaters/available-units'),
      ]);
      setRepeaters(loadedRepeaters);
      setUnits(loadedUnits);
      setSelectedId(prev => loadedRepeaters.some(r => r.id === prev) ? prev : (loadedRepeaters[0]?.id ?? null));
    } catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!creating && selected) { setDraftUnitIds(selected.unitIds); setName(selected.name); }
    setCheckedAll([]); setCheckedAssigned([]); setFilterAll(''); setFilterAssigned('');
    setToken(''); setShowToken(false);
  }, [selectedId, creating]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId || creating || tab !== 'transmisiones') return;
    let active = true;
    request<Transmission[]>(`/repeaters/${selectedId}/transmissions`)
      .then(rows => { if (active) setTransmissions(rows); })
      .catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [selectedId, creating, tab]);

  const allAvailable = useMemo(() => units.filter(u => !draftUnitIds.includes(u.id) && `${u.plate} ${u.alias ?? ''}`.toLowerCase().includes(filterAll.toLowerCase())), [units, draftUnitIds, filterAll]);
  const assigned = useMemo(() => units.filter(u => draftUnitIds.includes(u.id) && `${u.plate} ${u.alias ?? ''}`.toLowerCase().includes(filterAssigned.toLowerCase())), [units, draftUnitIds, filterAssigned]);
  const filteredRepeaters = repeaters.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const hasUnitChanges = !!selected && ([...draftUnitIds].sort().join('|') !== [...selected.unitIds].sort().join('|'));

  function showSuccess(value: string) { setNotice(value); setError(''); }
  function showError(err: unknown) { setError(message(err)); setNotice(''); }
  function newRepeater() {
    setCreating(true); setSelectedId(null); setName('SUTRAN'); setToken('');
    setDraftUnitIds([]); setTab('ajustes'); setNotice(''); setError('');
  }
  function cancelNew() {
    setCreating(false); setSelectedId(repeaters[0]?.id ?? null);
    setNotice(''); setError(''); setTab('resumen');
  }
  function moveToAssigned(ids: string[]) {
    setDraftUnitIds(current => [...new Set([...current, ...ids])]); setCheckedAll([]);
  }
  function moveToAvailable(ids: string[]) {
    setDraftUnitIds(current => current.filter(id => !ids.includes(id))); setCheckedAssigned([]);
  }

  async function saveNew() {
    if (!isAdmin || !creating || saving) return;
    if (name.trim().length < 4) return setError('El nombre debe tener al menos 4 caracteres.');
    if (!token.trim()) return setError('El token de SUTRAN es obligatorio.');
    setSaving(true); setError('');
    try {
      const created = await request<Repeater>('/repeaters', {
        method: 'POST', body: JSON.stringify({ name: name.trim(), type: 'SUTRAN', token: token.trim(), unitIds: draftUnitIds }),
      });
      setCreating(false); setToken(''); setRepeaters(current => [created, ...current]);
      setSelectedId(created.id); setTab('resumen'); showSuccess('Repetidor SUTRAN creado correctamente.');
    } catch (err) { showError(err); }
    finally { setSaving(false); }
  }
  async function saveSettings() {
    if (!isAdmin || !selected || saving) return;
    if (name.trim().length < 4) return setError('El nombre debe tener al menos 4 caracteres.');
    setSaving(true); setError('');
    try {
      const payload: { name: string; token?: string } = { name: name.trim() };
      if (token.trim()) payload.token = token.trim();
      const result = await request<Repeater>(`/repeaters/${selected.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setRepeaters(current => current.map(r => r.id === result.id ? result : r));
      setToken(''); showSuccess('Configuración guardada. El token no se mostrará nuevamente.');
    } catch (err) { showError(err); }
    finally { setSaving(false); }
  }
  async function saveUnits() {
    if (!selected || saving) return;
    setSaving(true); setError('');
    try {
      const response = await request<{ unitIds: string[] }>(`/repeaters/${selected.id}/units`, {
        method: 'PUT', body: JSON.stringify({ unitIds: draftUnitIds }),
      });
      setRepeaters(current => current.map(r => r.id === selected.id ? { ...r, unitIds: response.unitIds } : r));
      showSuccess('Unidades asignadas correctamente.');
    } catch (err) { showError(err); }
    finally { setSaving(false); }
  }
  async function toggleActive() {
    if (!selected || !isAdmin || saving) return;
    setSaving(true); setError('');
    try {
      const result = await request<Repeater>(`/repeaters/${selected.id}`, {
        method: 'PATCH', body: JSON.stringify({ active: !selected.active }),
      });
      setRepeaters(current => current.map(r => r.id === result.id ? result : r));
      showSuccess(result.active ? 'Repetidor activado.' : 'Repetidor desactivado.');
    } catch (err) { showError(err); }
    finally { setSaving(false); }
  }

  if (!user) return <div className="p-6 text-sm text-muted">Validando sesión...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Gestión de destinos</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Repetidores</h1>
          <p className="mt-1 text-sm text-muted">Protocolos habilitados: SUTRAN</p>
        </div>
        <div className="flex gap-2">
          <button className={btnSecondary} type="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} /> Actualizar</button>
          {isAdmin && !creating && <button className={btnPrimary} type="button" onClick={newRepeater}><Plus size={17} /> Nuevo repetidor</button>}
        </div>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert size={18} className="shrink-0"/>{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"><Check size={18} className="shrink-0"/>{notice}</div>}
      <div className="grid gap-5 xl:grid-cols-[295px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Destinos</h2><RadioTower size={19} className="text-primary"/></div>
            <div className="relative mt-3"><Search size={15} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar repetidor..." className={`${inputClass} pl-9`}/></div>
          </div>
          <div className="space-y-2 p-3">
            {loading && <p className="p-3 text-sm text-muted">Consultando PostgreSQL...</p>}
            {!loading && filteredRepeaters.length === 0 && <p className="p-3 text-sm text-muted">No hay repetidores SUTRAN registrados.</p>}
            {filteredRepeaters.map(r => <button key={r.id} type="button" onClick={() => { setCreating(false); setSelectedId(r.id); setTab('resumen'); setNotice(''); setError(''); }} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === r.id && !creating ? 'border-primary/30 bg-primary/5' : 'border-transparent hover:bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-900">{r.name}</span><ChevronRight size={16} className="text-primary"/></div>
              <p className="mt-1 text-xs text-muted">SUTRAN · {r.unitIds.length} unidades</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.active ? 'Activo' : 'Inactivo'}</span>
            </button>)}
          </div>
        </aside>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {creating ? (
            <div className="p-6">
              <button type="button" onClick={cancelNew} className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-primary"><ArrowLeft size={16}/> Volver</button>
              <h2 className="mb-1 text-2xl font-bold text-gray-900">Nuevo repetidor</h2>
              <p className="mb-6 text-sm text-muted">SUTRAN es el único protocolo disponible actualmente.</p>
              <BasicFields name={name} onName={setName} token={token} onToken={setToken} showToken={showToken} toggleToken={() => setShowToken(v => !v)} tokenRequired />
              <div className="mt-6"><h3 className="mb-3 font-bold">Asignar unidades</h3><UnitSelector all={allAvailable} assigned={assigned} checkedAll={checkedAll} checkedAssigned={checkedAssigned} setCheckedAll={setCheckedAll} setCheckedAssigned={setCheckedAssigned} filterAll={filterAll} setFilterAll={setFilterAll} filterAssigned={filterAssigned} setFilterAssigned={setFilterAssigned} add={moveToAssigned} remove={moveToAvailable}/></div>
              <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={cancelNew} className={btnSecondary}>Cancelar</button><button disabled={saving} onClick={() => void saveNew()} className={btnPrimary}>{saving && <Loader2 size={16} className="animate-spin"/>}<Save size={16}/> Crear repetidor</button></div>
            </div>
          ) : selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-primary p-3 text-white"><RadioTower size={21}/></div><div><h2 className="text-xl font-bold text-gray-900">{selected.name}</h2><p className="text-xs text-muted">SUTRAN · {selected.unitIds.length} unidades asignadas</p></div></div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selected.active && selected.tokenConfigured && selected.endpointConfigured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{selected.active && selected.tokenConfigured && selected.endpointConfigured ? 'Configurado (envíos no verificados)' : 'Inactivo o pendiente de configuración'}</span>
              </div>
              <div className="flex overflow-x-auto border-b border-border px-4">{([{ id: 'resumen', label: 'Resumen' },{ id: 'unidades', label: 'Unidades' },{ id: 'transmisiones', label: 'Transmisiones' },...(isAdmin ? [{ id: 'ajustes', label: 'Configuración' }] : [])] as { id: Tab; label: string }[]).map(item => <button key={item.id} type="button" onClick={() => {setTab(item.id); setError(''); setNotice('');}} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-gray-800'}`}>{item.label}</button>)}</div>
              <div className="p-6">
                {tab === 'resumen' && <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><Stat label="Protocolo" value="SUTRAN"/><Stat label="Unidades asignadas" value={String(selected.unitIds.length)}/><Stat label="Token" value={selected.tokenConfigured ? 'Configurado' : 'Pendiente'}/></div><div className="rounded-xl border border-border p-4 text-sm text-gray-700"><p><strong>Endpoint interno:</strong> {selected.endpointConfigured ? 'Configurado en el servidor' : 'Pendiente en el servidor'}</p><p className="mt-2"><strong>Estado:</strong> {selected.active ? 'Activo' : 'Inactivo'}</p><p className="mt-2 text-muted">La creación del repetidor no inicia los envíos. La cola/dispatcher debe conectarse al servicio SUTRAN para transmitir las tramas.</p></div>{isAdmin && <button type="button" onClick={() => void toggleActive()} disabled={saving} className={btnSecondary}>{selected.active ? 'Desactivar repetidor' : 'Activar repetidor'}</button>}</div>}
                {tab === 'unidades' && <><UnitSelector all={allAvailable} assigned={assigned} checkedAll={checkedAll} checkedAssigned={checkedAssigned} setCheckedAll={setCheckedAll} setCheckedAssigned={setCheckedAssigned} filterAll={filterAll} setFilterAll={setFilterAll} filterAssigned={filterAssigned} setFilterAssigned={setFilterAssigned} add={moveToAssigned} remove={moveToAvailable}/><div className="mt-5 flex justify-end"><button disabled={!hasUnitChanges || saving} onClick={() => void saveUnits()} className={btnPrimary}><Save size={16}/> Guardar asignaciones</button></div></>}
                {tab === 'transmisiones' && <><h3 className="mb-3 font-bold text-gray-900">Últimas transmisiones registradas</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted"><th className="p-3">Placa</th><th className="p-3">Estado</th><th className="p-3">HTTP</th><th className="p-3">Fecha</th></tr></thead><tbody>{transmissions.map(t => <tr key={t.id} className="border-b border-border/60"><td className="p-3 font-medium">{t.plate}</td><td className="p-3">{t.status}</td><td className="p-3">{t.httpCode ?? '—'}</td><td className="p-3">{new Date(t.createdAt).toLocaleString('es-PE')}</td></tr>)}</tbody></table>{transmissions.length === 0 && <p className="p-4 text-sm text-muted">Aún no hay transmisiones registradas para este repetidor.</p>}</div></>}
                {tab === 'ajustes' && isAdmin && <><BasicFields name={name} onName={setName} token={token} onToken={setToken} showToken={showToken} toggleToken={() => setShowToken(v => !v)} tokenConfigured={selected.tokenConfigured}/><div className="mt-5 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck size={16}/> El token se almacena cifrado y nunca se devuelve al navegador.</p><button disabled={saving} onClick={() => void saveSettings()} className={btnPrimary}><Save size={16}/> Guardar configuración</button></div></>}
              </div>
            </>
          ) : (
            <div className="p-10 text-center"><RadioTower size={32} className="mx-auto mb-3 text-primary"/><h2 className="text-xl font-bold">Sin repetidores configurados</h2><p className="mt-2 text-sm text-muted">{isAdmin ? 'Crea tu primer repetidor SUTRAN con un token.' : 'Solicita al administrador que configure SUTRAN.'}</p>{isAdmin && <button className={`${btnPrimary} mt-5`} onClick={newRepeater}><Plus size={17}/> Nuevo repetidor</button>}</div>
          )}
        </section>
      </div>
    </div>
  );
}

function message(err: unknown) { return err instanceof Error ? err.message : 'Ocurrió un error inesperado.'; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-lg font-bold text-gray-900">{value}</p></div>; }
function BasicFields({ name, onName, token, onToken, showToken, toggleToken, tokenRequired = false, tokenConfigured = false }: {
  name: string; onName: (v: string) => void; token: string; onToken: (v: string) => void;
  showToken: boolean; toggleToken: () => void; tokenRequired?: boolean; tokenConfigured?: boolean;
}) {
  return <div className="space-y-4 rounded-xl border border-border p-5"><h3 className="font-bold text-gray-900">Básicas</h3>
    <label className="block"><span className="mb-1.5 block text-sm font-semibold">Nombre (mínimo 4 caracteres)</span><input className={inputClass} value={name} maxLength={120} onChange={e => onName(e.target.value)}/></label>
    <label className="block"><span className="mb-1.5 block text-sm font-semibold">Protocolo de repetidor</span><select className={inputClass} value="SUTRAN" disabled><option value="SUTRAN">SUTRAN</option></select></label>
    <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><KeyRound size={16}/>Token de acceso {tokenRequired && <span className="text-red-500">*</span>}</span><div className="relative"><input className={`${inputClass} pr-11`} type={showToken ? 'text' : 'password'} value={token} onChange={e => onToken(e.target.value)} placeholder={tokenConfigured ? 'Dejar vacío para mantener el token actual' : 'Ingresa el token SUTRAN'} autoComplete="off"/><button type="button" onClick={toggleToken} className="absolute right-3 top-2.5 text-gray-500" aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}>{showToken ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
    <p className="text-xs text-muted">SUTRAN solo requiere el token. La URL, el encabezado HTTP y los reintentos se gestionan internamente.</p>
  </div>;
}
function UnitSelector({ all, assigned, checkedAll, checkedAssigned, setCheckedAll, setCheckedAssigned, filterAll, setFilterAll, filterAssigned, setFilterAssigned, add, remove }: {
  all: Unit[]; assigned: Unit[]; checkedAll: string[]; checkedAssigned: string[];
  setCheckedAll: (v: string[]) => void; setCheckedAssigned: (v: string[]) => void;
  filterAll: string; setFilterAll: (v: string) => void; filterAssigned: string; setFilterAssigned: (v: string) => void;
  add: (v: string[]) => void; remove: (v: string[]) => void;
}) {
  return <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)]">
    <UnitList title="Todas las unidades" items={all} search={filterAll} setSearch={setFilterAll} selected={checkedAll} setSelected={setCheckedAll}/>
    <div className="flex items-center justify-center gap-2 md:flex-col"><button className={btnSecondary} title="Asignar seleccionadas" aria-label="Asignar seleccionadas" type="button" disabled={!checkedAll.length} onClick={() => add(checkedAll)}><ChevronRight size={18}/></button><button className={btnSecondary} title="Quitar seleccionadas" aria-label="Quitar seleccionadas" type="button" disabled={!checkedAssigned.length} onClick={() => remove(checkedAssigned)}><ChevronRight className="rotate-180" size={18}/></button></div>
    <UnitList title="Unidades para repetidor" items={assigned} search={filterAssigned} setSearch={setFilterAssigned} selected={checkedAssigned} setSelected={setCheckedAssigned}/>
  </div>;
}
function UnitList({ title, items, search, setSearch, selected, setSelected }: { title: string; items: Unit[]; search: string; setSearch: (v: string) => void; selected: string[]; setSelected: (v: string[]) => void }) {
  const ids = items.map(x => x.id);
  const allSelected = ids.length > 0 && ids.every(id => selected.includes(id));
  return <div className="min-w-0 space-y-2"><div className="flex items-center justify-between gap-1"><p className="text-sm font-semibold text-gray-800">{title}</p><span className="text-xs text-muted">{items.length}</span></div><div className="relative"><Search size={14} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} pl-9`} placeholder="Buscar placa..."/></div><div className="h-48 overflow-auto rounded-xl border border-border bg-white p-2">{items.map(u => <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50"><input type="checkbox" checked={selected.includes(u.id)} onChange={() => setSelected(selected.includes(u.id) ? selected.filter(x => x !== u.id) : [...selected, u.id])}/><Truck size={13} className="text-gray-400"/><span className="font-medium">{u.plate}</span>{!u.active && <span className="text-xs text-muted">Inactiva</span>}</label>)}{items.length === 0 && <p className="p-3 text-sm text-muted">Sin unidades</p>}</div><button type="button" className="w-full rounded-lg border border-border p-2 text-xs font-semibold text-primary hover:bg-primary/5" onClick={() => setSelected(allSelected ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])])}>{allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}</button></div>;
}

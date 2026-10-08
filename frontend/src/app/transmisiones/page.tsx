'use client';
import { useEffect, useState } from 'react';
import { Search, RefreshCw, Eye } from 'lucide-react';
import TransmissionExportButtons from '@/components/transmissions/TransmissionExportButtons';
import { apiUrl } from '@/lib/api';

type Transmission = {
  id: string; eventTime: string | null; createdAt: string;
  plate: string; imei: string; clientName: string | null; repeaterName: string;
  status: string; httpCode: number | null; error: string | null; attempts: number;
};
export default function Transmisiones() {
  const [rows, setRows] = useState<Transmission[]>([]);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<{id:string;name:string}[]>([]);
  const [repeaters, setRepeaters] = useState<{id:string;name:string}[]>([]);
  const [clientId, setClientId] = useState('');
  const [repeaterId, setRepeaterId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (clientId) params.set('clientId', clientId);
      if (repeaterId) params.set('repeaterId', repeaterId);
      const res = await fetch(apiUrl(`/api/transmissions?${params}`), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo consultar el historial.');
      setRows(await res.json() as Transmission[]);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* al cambiar filtros */ }, [status, search, clientId, repeaterId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    Promise.all(['/api/clients','/api/repeaters'].map(path => fetch(apiUrl(path), {credentials:'include'})
      .then(r => r.ok ? r.json() : []))).then(([c,r]) => {
        if (Array.isArray(c)) setClients(c);
        if (Array.isArray(r)) setRepeaters(r);
      }).catch(() => undefined);
  }, []);
  const showDetail = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/transmissions/${id}`), { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo consultar el detalle.');
      setDetail(await res.json() as Record<string, unknown>);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const requeue = async (row: Transmission) => {
    if (!window.confirm(`¿Reprocesar ${row.plate} hacia ${row.repeaterName}? Puede enviarse realmente al destino si DRY_RUN=false.`)) return;
    setRetrying(row.id);
    try {
      const res = await fetch(apiUrl(`/api/transmissions/${row.id}/retry`), { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json() as {error?: string}).error || 'No se pudo reprocesar');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRetrying(null); }
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4 items-center"><h1 className="text-3xl font-bold text-gray-900">Transmisiones</h1><TransmissionExportButtons clientId={clientId} repeaterId={repeaterId} status={status} /></div>
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 flex flex-wrap gap-3 items-center border-b border-border">
        <div className="relative flex-1 min-w-[190px]"><Search className="absolute top-2.5 left-3 text-gray-400" size={18}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar placa o IMEI" className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl" /></div>
        <select value={clientId} onChange={e => setClientId(e.target.value)} className="py-2 px-3 border border-gray-200 rounded-xl">
          <option value="">Todos los clientes</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={repeaterId} onChange={e => setRepeaterId(e.target.value)} className="py-2 px-3 border border-gray-200 rounded-xl">
          <option value="">Todos los repetidores</option>{repeaters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="py-2 px-3 border border-gray-200 rounded-xl">
          <option value="">Todos los resultados</option>{['PENDING','PROCESSING','RETRY','SENT','FAILED','SIMULATED','SKIPPED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => void load()} aria-label="Actualizar" className="p-2 border border-gray-200 rounded-xl"><RefreshCw size={18}/></button>
      </div>
      {error && <p className="p-4 text-red-700">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-gray-50 text-muted border-b border-border"><tr>
        {['Fecha evento','Placa','IMEI','Cliente','Repetidor','Estado','HTTP','Intentos','Detalle'].map(h => <th key={h} className="p-3">{h}</th>)}
      </tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-border">
        <td className="p-3">{r.eventTime ? new Date(r.eventTime).toLocaleString('es-PE') : '—'}</td>
        <td className="p-3 font-medium">{r.plate}</td><td className="p-3">{r.imei}</td>
        <td className="p-3">{r.clientName || '—'}</td><td className="p-3">{r.repeaterName}</td>
        <td className="p-3">{r.status}</td><td className="p-3">{r.httpCode ?? '—'}</td><td className="p-3">{r.attempts}</td>
        <td className="p-3"><div className="flex gap-2 items-center"><button onClick={() => void showDetail(r.id)} aria-label="Ver detalle" className="text-primary"><Eye size={18}/></button>
        {['FAILED','SIMULATED'].includes(r.status) && <button disabled={retrying !== null} onClick={() => void requeue(r)} className="text-primary underline disabled:opacity-50">Reprocesar</button>}</div></td>
      </tr>)}{!rows.length && <tr><td colSpan={9} className="p-8 text-center text-muted">{loading ? 'Consultando...' : 'No hay registros con estos filtros.'}</td></tr>}</tbody></table></div>
    </div>
    {detail && <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Trazabilidad de la transmisión</h2><button onClick={() => setDetail(null)} className="underline">Cerrar</button></div>
      <pre className="mt-4 p-4 bg-gray-50 rounded-xl text-xs whitespace-pre-wrap break-all overflow-x-auto">{JSON.stringify(detail, null, 2)}</pre>
    </div>}
    <p className="text-xs text-muted">Se muestran las 100 transmisiones más recientes. Usa CSV/Excel para exportar el historial.</p>
  </div>;
}

'use client';
import { useEffect, useState } from 'react';
import { Search, RefreshCw, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import TransmissionExportButtons from '@/components/transmissions/TransmissionExportButtons';
import { apiUrl } from '@/lib/api';

const PAGE_SIZE = 100;
const labels: Record<string, string> = {
  PENDING: 'En cola', PROCESSING: 'Procesando', RETRY: 'Reintentando', FAILED: 'Fallida',
  SENT: 'Enviada', SIMULATED: 'Simulada (histórica)', SKIPPED: 'Omitida',
};
type Transmission = {
  id: string; eventTime: string | null; receivedAt: string | null; createdAt: string;
  lastAttemptAt: string | null; lastResponseAt: string | null;
  plate: string; imei: string; clientName: string | null; repeaterName: string;
  status: string; httpCode: number | null; httpResponded: boolean;
  error: string | null; attempts: number;
};
type Attempt = { attemptNo: number; attemptedAt: string; completedAt: string; status: string;
  httpCode: number | null; payloadSent: unknown; responseReceived: unknown; error: string | null };
type TransmissionDetail = Transmission & {
  payloadSent: unknown; responseReceived: unknown; attemptHistory: Attempt[];
};
const formatDate = (v: string | null | undefined) => v ? new Date(v).toLocaleString('es-PE', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}) : '—';
const pretty = (v: unknown) => v === null || v === undefined ? 'Sin cuerpo de respuesta' :
  typeof v === 'string' ? v : JSON.stringify(v, null, 2);
async function errText(res: Response) {
  const body = await res.json().catch(() => ({})) as {error?: string};
  return body.error || `Error HTTP ${res.status}`;
}

export default function Transmisiones() {
  const [rows, setRows] = useState<Transmission[]>([]);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<{id:string;name:string}[]>([]);
  const [repeaters, setRepeaters] = useState<{id:string;name:string}[]>([]);
  const [clientId, setClientId] = useState('');
  const [repeaterId, setRepeaterId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateField, setDateField] = useState('createdAt');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<TransmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  if (clientId) query.set('clientId', clientId);
  if (repeaterId) query.set('repeaterId', repeaterId);
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  query.set('dateField', dateField);
  const queryString = query.toString();

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/transmissions?${queryString}`), { credentials: 'include', cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(await errText(res));
        const data = await res.json() as Transmission[];
        if (alive) { setRows(data); setError(''); }
      } catch (e) {
        if (alive) { setRows([]); setError(e instanceof Error ? e.message : String(e)); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; controller.abort(); };
  }, [queryString]);

  useEffect(() => {
    Promise.all(['/api/clients','/api/repeaters'].map(path => fetch(apiUrl(path), {credentials:'include'})
      .then(r => r.ok ? r.json() : []))).then(([c,r]) => {
        if (Array.isArray(c)) setClients(c);
        if (Array.isArray(r)) setRepeaters(r);
      }).catch(() => undefined);
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/transmissions?${queryString}`), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(await errText(res));
      setRows(await res.json() as Transmission[]); setError('');
    } catch (e) { setRows([]); setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  const showDetail = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/transmissions/${id}`), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(await errText(res));
      setDetail(await res.json() as TransmissionDetail);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const requeue = async (row: Transmission) => {
    if (!window.confirm(`¿Reenviar REALMENTE ${row.plate} a ${row.repeaterName}? Se contactará la API externa.`)) return;
    setRetrying(row.id);
    try {
      const res = await fetch(apiUrl(`/api/transmissions/${row.id}/retry`), { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(await errText(res));
      setDetail(null); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRetrying(null); }
  };
  const changeFilter = (callback: () => void) => { setPage(0); callback(); };
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4 items-center"><div><h1 className="text-3xl font-bold text-gray-900">Transmisiones</h1>
      <p className="text-sm text-muted">Historial real de envíos, rechazos y respuestas de las APIs.</p></div>
      <TransmissionExportButtons clientId={clientId} repeaterId={repeaterId} status={status}
        search={search} dateFrom={dateFrom} dateTo={dateTo} dateField={dateField} />
    </div>
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 flex flex-wrap gap-3 items-end border-b border-border">
        <label className="flex-1 min-w-[170px] text-xs text-muted">Buscar placa o IMEI
          <span className="relative block mt-1"><Search className="absolute top-2.5 left-3 text-gray-400" size={18}/>
            <input value={search} onChange={e => changeFilter(() => setSearch(e.target.value))} placeholder="Placa o IMEI" className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm" /></span>
        </label>
        <label className="text-xs text-muted">Cliente
          <select value={clientId} onChange={e => changeFilter(() => setClientId(e.target.value))} className="block mt-1 py-2 px-3 border border-gray-200 rounded-xl text-sm">
            <option value="">Todos los clientes</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Repetidor
          <select value={repeaterId} onChange={e => changeFilter(() => setRepeaterId(e.target.value))} className="block mt-1 py-2 px-3 border border-gray-200 rounded-xl text-sm">
            <option value="">Todos</option>{repeaters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Estado
          <select value={status} onChange={e => changeFilter(() => setStatus(e.target.value))} className="block mt-1 py-2 px-3 border border-gray-200 rounded-xl text-sm">
            <option value="">Todos</option>{['PENDING','PROCESSING','RETRY','SENT','FAILED','SIMULATED','SKIPPED'].map(s => <option key={s} value={s}>{labels[s]}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Filtrar fecha de
          <select value={dateField} onChange={e => changeFilter(() => setDateField(e.target.value))} className="block mt-1 py-2 px-3 border border-gray-200 rounded-xl text-sm">
            <option value="createdAt">Registro</option><option value="eventTime">Evento GPS</option>
            <option value="receivedAt">Recepción</option><option value="lastAttemptAt">Último intento</option>
          </select>
        </label>
        <label className="text-xs text-muted">Desde
          <input aria-label="Fecha desde" type="date" value={dateFrom} max={dateTo || undefined}
            onChange={e => changeFilter(() => setDateFrom(e.target.value))} className="block mt-1 py-2 px-3 border border-gray-200 rounded-xl text-sm" />
        </label>
        <label className="text-xs text-muted">Hasta
          <input aria-label="Fecha hasta" type="date" value={dateTo} min={dateFrom || undefined}
            onChange={e => changeFilter(() => setDateTo(e.target.value))} className="block mt-1 py-2 px-3 border border-gray-200 rounded-xl text-sm" />
        </label>
        <button onClick={() => { void reload(); }} title="Actualizar" aria-label="Actualizar transmisiones" className="p-2 border border-gray-200 rounded-xl"><RefreshCw size={18}/></button>
      </div>
      {error && <p role="alert" className="p-4 text-red-700">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-gray-50 text-muted border-b border-border"><tr>
        {['Fecha evento','Último intento','Placa','IMEI','Cliente','Repetidor','Estado','Respuesta HTTP','Intentos','Detalle'].map(h => <th key={h} className="p-3">{h}</th>)}
      </tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-border">
        <td className="p-3">{formatDate(r.eventTime)}</td><td className="p-3">{formatDate(r.lastAttemptAt)}</td>
        <td className="p-3 font-medium">{r.plate}</td><td className="p-3">{r.imei}</td>
        <td className="p-3">{r.clientName || '—'}</td><td className="p-3">{r.repeaterName}</td>
        <td className="p-3">{labels[r.status] || r.status}</td>
        <td className="p-3">{r.httpResponded ? <span className={r.status === 'SENT' ? 'text-green-700' : 'text-red-700'}>Sí · HTTP {r.httpCode}</span> : <span className="text-muted">No · {r.attempts ? 'sin respuesta HTTP' : 'no intentada'}</span>}</td>
        <td className="p-3">{r.attempts}</td>
        <td className="p-3"><div className="flex gap-2 items-center"><button onClick={() => void showDetail(r.id)} aria-label="Ver detalle y respuesta" title="Ver petición y respuesta" className="text-primary"><Eye size={18}/></button>
          {['FAILED','SIMULATED','SKIPPED'].includes(r.status) && <button disabled={retrying !== null} onClick={() => void requeue(r)} className="text-primary underline disabled:opacity-50">Reenviar</button>}</div></td>
      </tr>)}{!rows.length && <tr><td colSpan={10} className="p-8 text-center text-muted">{loading ? 'Consultando...' : error ? 'Error de consulta; no hay datos disponibles.' : 'No hay transmisiones con estos filtros.'}</td></tr>}</tbody></table></div>
      <div className="p-3 flex items-center justify-between text-sm text-muted"><span>Registros {page * PAGE_SIZE + (rows.length ? 1 : 0)}–{page * PAGE_SIZE + rows.length} · Fechas: Perú (UTC−05:00)</span>
        <div className="flex gap-2"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="px-3 py-2 border rounded-lg disabled:opacity-40 flex gap-1 items-center"><ChevronLeft size={16}/>Anterior</button>
          <button disabled={rows.length < PAGE_SIZE || loading} onClick={() => setPage(p => p + 1)} className="px-3 py-2 border rounded-lg disabled:opacity-40 flex gap-1 items-center">Siguiente<ChevronRight size={16}/></button></div>
      </div>
    </div>
    {detail && <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Trazabilidad · {detail.plate} → {detail.repeaterName}</h2><button onClick={() => setDetail(null)} className="underline">Cerrar</button></div>
      <div className="flex flex-wrap gap-4 text-sm"><span>Estado: <strong>{labels[detail.status] || detail.status}</strong></span><span>Intentos: <strong>{detail.attempts}</strong></span>
        <span>Respuesta HTTP: <strong>{detail.httpResponded ? `Sí · ${detail.httpCode}` : 'No'}</strong></span>
        <span>Último intento: <strong>{formatDate(detail.lastAttemptAt)}</strong></span>
        <span>Respuesta recibida: <strong>{formatDate(detail.lastResponseAt)}</strong></span></div>
      {detail.error && <p className="text-red-700 text-sm">{detail.error}</p>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section><h3 className="font-semibold mb-2">Payload enviado / preparado</h3><pre className="p-4 bg-gray-50 rounded-xl text-xs whitespace-pre-wrap break-all max-h-80 overflow-auto">{pretty(detail.payloadSent)}</pre></section>
        <section><h3 className="font-semibold mb-2">Respuesta del servidor (último intento)</h3><pre className="p-4 bg-gray-50 rounded-xl text-xs whitespace-pre-wrap break-all max-h-80 overflow-auto">{pretty(detail.responseReceived)}</pre></section>
      </div>
      <h3 className="font-semibold">Historial de intentos HTTP</h3>
      {detail.attemptHistory.length === 0 && <p className="text-sm text-muted">No hay detalle de intentos antiguos; se registra a partir de la nueva versión.</p>}
      {detail.attemptHistory.map(a => <details key={a.attemptNo} className="border border-border rounded-xl p-3">
        <summary className="cursor-pointer text-sm font-medium">Intento {a.attemptNo} · {formatDate(a.attemptedAt)} · {labels[a.status] || a.status} · {a.httpCode !== null ? `HTTP ${a.httpCode}` : 'Sin respuesta HTTP'}</summary>
        {a.error && <p className="text-sm text-red-700 mt-2">{a.error}</p>}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3"><pre className="text-xs p-3 bg-gray-50 rounded-lg whitespace-pre-wrap break-all overflow-auto max-h-56">{pretty(a.payloadSent)}</pre>
          <pre className="text-xs p-3 bg-gray-50 rounded-lg whitespace-pre-wrap break-all overflow-auto max-h-56">{pretty(a.responseReceived)}</pre></div>
      </details>)}
    </div>}
    <p className="text-xs text-muted">Se consulta PostgreSQL. HTTP 403/401 confirma una respuesta de rechazo; los tiempos de espera y errores de red pueden no tener código HTTP. Un HTTP 200 no siempre implica aceptación: también se valida el contenido de la respuesta.</p>
  </div>;
}

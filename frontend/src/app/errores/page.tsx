'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiUrl } from '@/lib/api';

type Failure = { id: string; plate: string; imei: string; repeaterName: string; error: string | null; createdAt: string; attempts: number; status: string };
export default function Errores() {
  const [rows, setRows] = useState<Failure[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => {
    try {
      const res = await fetch(apiUrl('/api/transmissions?status=FAILED&limit=200'), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar fallos.');
      setRows(await res.json() as Failure[]); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);
  const retry = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(apiUrl(`/api/transmissions/${id}/retry`), { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json() as {error?:string}).error || 'Error al reintentar');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  return <div className="space-y-6">
    <div className="flex justify-between items-center"><div><h1 className="text-3xl font-bold text-gray-900">Errores de transmisión</h1>
      <p className="text-muted mt-1">Trabajos fallidos después de los intentos permitidos</p></div>
      <button onClick={() => void load()} className="px-4 py-2 border rounded-xl flex gap-2 items-center"><RefreshCw size={18}/>Actualizar</button></div>
    {error && <p className="text-red-700">{error}</p>}
    <div className="bg-card rounded-2xl border border-border overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-gray-50 border-b border-border"><tr>
      {['Placa','IMEI','Repetidor','Error','Fecha','Intentos','Acción'].map(h => <th key={h} className="p-3">{h}</th>)}
    </tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-border"><td className="p-3">{r.plate}</td>
      <td className="p-3">{r.imei}</td><td className="p-3">{r.repeaterName}</td>
      <td className="p-3 max-w-md whitespace-normal text-red-700">{r.error || 'Sin descripción'}</td>
      <td className="p-3">{new Date(r.createdAt).toLocaleString('es-PE')}</td><td className="p-3">{r.attempts}</td>
      <td className="p-3"><button disabled={busy !== null} onClick={() => void retry(r.id)} className="px-3 py-2 border rounded-lg text-primary disabled:opacity-50">Reintentar</button></td>
    </tr>)}{!rows.length && <tr><td colSpan={7} className="p-8 text-center text-muted">No hay transmisiones fallidas.</td></tr>}</tbody></table></div>
    <p className="text-xs text-muted">Reintentar realiza un envío real si el servicio de réplicas está configurado con DRY_RUN=false. Verifica antes las credenciales y el destino.</p>
  </div>;
}

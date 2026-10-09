'use client';
import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, XCircle } from 'lucide-react';
import { apiUrl } from '@/lib/api';

type Stats = {
  totals: { received: number; sent: number; errors: number };
  repeaters: { id: string; name: string; active: boolean; assignedUnits: number; sentUnits: number }[];
};

async function apiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as {error?: string};
  return new Error(`${body.error || fallback} (HTTP ${response.status})`);
}
export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<{id: string; name: string}[]>([]);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch(apiUrl(`/api/stats/dashboard${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`), { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw await apiError(response, 'No se pudieron consultar las estadísticas.');
        const data = await response.json() as Stats;
        if (alive) { setStats(data); setError(''); }
      } catch (e) {
        if (alive) { setStats(null); setError(e instanceof Error ? e.message : String(e)); }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [clientId]);
  useEffect(() => {
    fetch(apiUrl('/api/clients'), { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setClients(data); })
      .catch(() => undefined);
  }, []);
  const values = [
    { label: 'TRAMAS RECIBIDAS', value: stats?.totals.received, icon: ArrowDownRight, note: 'Mensajes RAW recibidos desde Wialon' },
    { label: 'ENVIADAS', value: stats?.totals.sent, icon: ArrowUpRight, note: 'Transmisiones confirmadas por la API' },
    { label: 'FALLIDAS / REINTENTANDO', value: stats?.totals.errors, icon: XCircle, note: 'Errores definitivos o en reintento' },
  ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <select value={clientId} onChange={e => setClientId(e.target.value)} className="border border-border rounded-xl py-2 px-3" aria-label="Filtrar cliente">
        <option value="">Todos los clientes</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
      <strong>No se pudieron obtener estadísticas reales.</strong> {error}
      <p className="text-sm mt-1">Revisa el backend, PostgreSQL, las migraciones y la URL de la API. No se mostrarán cifras de ejemplo.</p>
    </div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {values.map(({label,value,icon:Icon,note}) => <div key={label} className="bg-card p-5 rounded-2xl shadow-sm border border-border">
        <Icon className="text-primary mb-4" size={24}/><p className="text-xs text-muted font-semibold">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{value ?? '—'}</p><p className="text-xs text-muted mt-2">{note}</p>
      </div>)}
    </div>
    <h2 className="text-xl font-bold text-gray-900">ESTADO POR REPETIDOR (ÚLTIMAS 24 HORAS)</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stats && (stats.repeaters.length ? stats.repeaters.map(r => <div key={r.id} className="bg-card p-5 rounded-2xl border border-border">
        <div className="flex justify-between"><strong>{r.name}</strong><span>{r.active ? 'Activo' : 'Inactivo'}</span></div>
        <p className="text-sm text-muted mt-3">Unidades asignadas: {r.assignedUnits} · Con envíos exitosos: {r.sentUnits}</p>
        <p className="font-semibold mt-2">{r.assignedUnits ? Math.round(r.sentUnits / r.assignedUnits * 100) : 0}% de unidades enviando</p>
      </div>) : <p className="text-muted">No hay repetidores configurados.</p>)}
    </div>
    <p className="text-xs text-muted">Datos reales de PostgreSQL. Actualización automática cada 15 segundos. Cada envío se cuenta por destino; una trama puede retransmitirse a varios repetidores.</p>
  </div>;
}

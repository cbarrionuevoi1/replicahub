'use client';
import { useEffect, useState } from 'react';
import { Activity, Database } from 'lucide-react';
import { apiUrl } from '@/lib/api';
export default function Sistema() {
  const [api, setApi] = useState<'checking'|'online'|'offline'>('checking');
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
        setApi(response.ok ? 'online' : 'offline');
      } catch { setApi('offline'); }
    };
    void load(); const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, []);
  return <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-900">Estado del sistema</h1>
    <div className="bg-card p-6 rounded-2xl border border-border flex gap-4 items-center"><Activity className="text-primary"/>
      <div><strong>ReplicaHub API</strong><p className="text-muted">{api === 'online' ? 'Conectada' : api === 'offline' ? 'No disponible' : 'Verificando...'}</p></div></div>
    <div className="bg-card p-6 rounded-2xl border border-border flex gap-4 items-center"><Database className="text-primary"/>
      <div><strong>PostgreSQL y servicios</strong><p className="text-muted">La API comprueba su conexión a PostgreSQL al iniciar. Para verificar TCP y el worker, consulta sus logs locales/PM2. No se mostrarán estados simulados.</p></div></div>
  </div>;
}

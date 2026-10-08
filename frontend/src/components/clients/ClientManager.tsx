"use client";

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2 } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { ClientFormModal } from './ClientFormModal';

export function ClientManager() {
  const [clients, setClients] = useState<any[]>([]);
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [c, u] = await Promise.all([
        fetch(apiUrl('/api/clients'), { credentials: 'include' }).then(r => r.json()),
        fetch(apiUrl('/api/units'), { credentials: 'include' }).then(r => r.json())
      ]);
      setAllUnits(Array.isArray(u) ? u : []);
      setClients(Array.isArray(c) ? c : []);
      setError('');
    } catch (err: any) {
      setError('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredClients = clients.filter(c => {
    const term = search.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.ruc && c.ruc.includes(term));
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Clientes</h1>
        <button 
          onClick={() => { setEditingClient(null); setShowModal(true); setError(''); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o RUC..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
            />
          </div>
        </div>
        {error && <div className="m-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-muted text-sm border-b border-border">
              <th className="p-4 font-medium">Nombre / Razón Social</th>
              <th className="p-4 font-medium">RUC</th>
              <th className="p-4 font-medium">Unidades</th>
              <th className="p-4 font-medium">Contacto</th>
              <th className="p-4 font-medium">Estado</th>
              <th className="p-4 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted">Cargando...</td></tr>
            ) : filteredClients.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted">No se encontraron clientes.</td></tr>
            ) : (
              filteredClients.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-bold text-gray-900">{c.name}</td>
                  <td className="p-4 text-gray-600 font-mono">{c.ruc || '-'}</td>
                  <td className="p-4">
                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold">
                      {c.units?.length || 0}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">{c.contact || '-'}</td>
                  <td className="p-4">
                    {c.active ? 
                      <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">Activo</span> : 
                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-bold">Inactivo</span>
                    }
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => { setEditingClient(c); setShowModal(true); setError(''); }}
                      className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ClientFormModal 
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
          editingClient={editingClient}
          allUnits={allUnits}
        />
      )}
    </div>
  );
}

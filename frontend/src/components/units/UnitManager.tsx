"use client";

import { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle, Edit2, ShieldAlert } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { UnitFormModal } from './UnitFormModal';

export function UnitManager() {
  const [units, setUnits] = useState<any[]>([]);
  const [pendingUnits, setPendingUnits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [u, p, c] = await Promise.all([
        fetch(apiUrl('/api/units'), { credentials: 'include' }).then(r => r.json()),
        fetch(apiUrl('/api/units/pending'), { credentials: 'include' }).then(r => r.json()),
        fetch(apiUrl('/api/clients'), { credentials: 'include' }).then(r => r.json())
      ]);
      setUnits(u);
      setPendingUnits(p);
      setClients(c);
      setError('');
    } catch (err: any) {
      setError('Error al cargar unidades: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const registeredUnits = units;

  const filteredRegistered = registeredUnits.filter(u => {
    const matchesSearch = !search || u.plate?.toLowerCase().includes(search.toLowerCase()) || u.imei.includes(search);
    const matchesClient = !clientFilter || u.clientId === clientFilter;
    return matchesSearch && matchesClient;
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Unidades</h1>
        <button 
          onClick={() => { setEditingUnit(null); setShowModal(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={20} /> Registrar Unidad
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="bg-card border border-border px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
          <span className="font-bold text-gray-900 text-lg">{registeredUnits.length}</span>
          <span className="text-muted text-sm font-medium">Registradas</span>
        </div>
        <div className="bg-warning/10 border border-warning/20 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
          <span className="font-bold text-warning text-lg">{pendingUnits.length}</span>
          <span className="text-warning text-sm font-medium">Pendientes de Identificación</span>
        </div>
      </div>

      {pendingUnits.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-warning mb-3 flex items-center gap-2">
            <AlertCircle size={20} /> PENDIENTES DE IDENTIFICACIÓN
          </h2>
          <div className="bg-card rounded-2xl shadow-sm border border-warning/30 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-warning/5 text-warning-dark text-sm border-b border-warning/20">
                  <th className="p-4 font-medium">UID Wialon</th>
                  <th className="p-4 font-medium">Primera Recepción</th>
                  <th className="p-4 font-medium">Última Recepción</th>
                  <th className="p-4 font-medium">Tramas</th>
                  <th className="p-4 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendingUnits.map(p => (
                  <tr key={p.imei} className="border-b border-border/50 hover:bg-gray-50/50">
                    <td className="p-4 font-medium">{p.imei}</td>
                    <td className="p-4 text-muted text-sm">
                      {p.firstTransmissionAt ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.firstTransmissionAt)) : '-'}
                    </td>
                    <td className="p-4 text-muted text-sm">
                      {p.lastTransmissionAt ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.lastTransmissionAt)) : '-'}
                    </td>
                    <td className="p-4 font-medium">
                      {p.totalFrames}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => { setEditingUnit({ imei: p.imei, isPending: true }); setShowModal(true); }}
                        className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1"
                      >
                        <Edit2 size={16} /> Asociar / Registrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">UNIDADES REGISTRADAS</h2>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Buscar placa / IMEI..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
              />
            </div>
            <select 
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700 cursor-pointer"
            >
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-muted text-sm border-b border-border">
                <th className="p-4 font-medium">Placa</th>
                <th className="p-4 font-medium">IMEI</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Estado Admin</th>
                <th className="p-4 font-medium">Conexión</th>
                <th className="p-4 font-medium">Repetidores</th>
                <th className="p-4 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted">Cargando...</td></tr>
              ) : filteredRegistered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted">No se encontraron unidades.</td></tr>
              ) : (
                filteredRegistered.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{u.plate}</td>
                    <td className="p-4 font-mono text-sm text-gray-600">{u.imei}</td>
                    <td className="p-4 text-gray-700">{u.client?.name || <span className="text-gray-400 italic">Sin cliente</span>}</td>
                    <td className="p-4">
                      {u.active ? 
                        <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">Activo</span> : 
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-bold">Inactivo</span>
                      }
                    </td>
                    <td className="p-4 text-sm">
                      {!u.lastTransmissionAt ? (
                        <span className="text-gray-400 flex items-center gap-1"><ShieldAlert size={14}/> Sin datos</span>
                      ) : (
                        Date.now() - new Date(u.lastTransmissionAt).getTime() < 1000 * 60 * 10 ? (
                          <span className="text-green-600 font-medium">Recibiendo</span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1">Sin conexión</span>
                        )
                      )}
                    </td>
                    <td className="p-4">
                      {u.unitRepeaters?.length > 0 ? (
                        <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold">{u.unitRepeaters.length} destinos</span>
                      ) : (
                        <span className="text-gray-400 text-sm">0</span>
                      )}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => { setEditingUnit(u); setShowModal(true); }}
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
      </div>

      {showModal && (
        <UnitFormModal 
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
          clients={clients}
          units={registeredUnits}
          editingUnit={editingUnit}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface UnitFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  clients: any[];
  units?: any[];
  editingUnit?: any;
}

export function UnitFormModal({ onClose, onSuccess, clients, units = [], editingUnit }: UnitFormModalProps) {
  const isPending = editingUnit?.isPending;
  const [mode, setMode] = useState<'create' | 'associate'>(isPending ? 'associate' : 'create');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    plate: editingUnit?.plate || '',
    imei: editingUnit?.imei || (isPending ? editingUnit.imei : ''), // if pending, suggest its imei
    clientId: editingUnit?.clientId || '',
    active: editingUnit ? (editingUnit.active ?? true) : true,
    wialonUniqueId: editingUnit?.wialonUniqueId || (isPending ? editingUnit.imei : ''),
  });

  const [associateData, setAssociateData] = useState({
    unitId: '',
    updateHistorical: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);

      if (isPending && mode === 'associate') {
        if (!associateData.unitId) return setError('Seleccione una unidad');
        
        const res = await fetch(apiUrl(`/api/units/pending/${encodeURIComponent(editingUnit.imei)}/associate`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(associateData),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        
      } else {
        if (!formData.plate.trim() || !formData.imei.trim()) return setError('Placa e IMEI son obligatorios');

        const isUpdate = editingUnit && !isPending;
        const method = isUpdate ? 'PATCH' : 'POST';
        const url = isUpdate ? `/api/units/${editingUnit.id}` : `/api/units`;

        const res = await fetch(apiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');

        // If it was pending and we created a new one, we also want to associate historical data!
        // We can do this automatically by calling the associate endpoint right after creation, or backend can do it.
        // But backend doesn't automatically process historical on create. So let's call associate if isPending:
        if (isPending) {
          const createdUnit = await res.json();
          const assocRes = await fetch(apiUrl(`/api/units/pending/${encodeURIComponent(editingUnit.imei)}/associate`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ unitId: createdUnit.id, updateHistorical: associateData.updateHistorical }),
          });
          if (!assocRes.ok) throw new Error((await assocRes.json()).error || 'La unidad se creó, pero falló la asociación histórica.');
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">
            {isPending ? 'Identificar Unidad (Wialon)' : (editingUnit ? 'Editar Unidad' : 'Registrar Unidad')}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>}
          
          {isPending && (
            <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
              <button type="button" onClick={() => setMode('associate')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'associate' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Asociar a existente</button>
              <button type="button" onClick={() => setMode('create')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'create' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Crear nueva</button>
            </div>
          )}

          {(!isPending || mode === 'create') && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Placa *</label>
                <input
                  type="text"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                  placeholder="Ej. ABC-123"
                  required={mode === 'create'}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">IMEI *</label>
                <input
                  type="text"
                  value={formData.imei}
                  onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                  placeholder="15 dígitos"
                  required={mode === 'create'}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Wialon Unique ID</label>
                <input
                  type="text"
                  value={formData.wialonUniqueId}
                  onChange={(e) => setFormData({ ...formData, wialonUniqueId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                  placeholder="Opcional. ID que transmite el equipo a Wialon."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Cliente</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                >
                  <option value="">-- Sin asignar --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Unidad activa (Estado administrativo)
                </label>
              </div>
            </>
          )}

          {isPending && mode === 'associate' && (
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl">
                <p className="text-sm text-warning-dark">
                  Se asignará el identificador <strong>{editingUnit.imei}</strong> a la unidad seleccionada.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Seleccionar Unidad</label>
                <select
                  value={associateData.unitId}
                  onChange={(e) => setAssociateData({ ...associateData, unitId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                  required
                >
                  <option value="">-- Seleccionar --</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.plate} (IMEI: {u.imei})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isPending && (
            <div className="flex items-center gap-3 pt-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="historical"
                checked={associateData.updateHistorical}
                onChange={(e) => setAssociateData({ ...associateData, updateHistorical: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="historical" className="text-sm font-medium text-gray-700 cursor-pointer leading-tight">
                Asociar y procesar datos históricos<br/>
                <span className="text-xs text-gray-500 font-normal">Vincula tramas pasadas a esta unidad (sin perder RAW).</span>
              </label>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

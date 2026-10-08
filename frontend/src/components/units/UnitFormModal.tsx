"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface UnitFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  clients: any[];
  editingUnit?: any;
}

export function UnitFormModal({ onClose, onSuccess, clients, editingUnit }: UnitFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    plate: editingUnit?.plate || '',
    imei: editingUnit?.imei || '',
    clientId: editingUnit?.clientId || '',
    active: editingUnit ? editingUnit.active : true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.plate.trim() || !formData.imei.trim()) return setError('Placa e IMEI son obligatorios');

    try {
      setLoading(true);
      if (editingUnit) {
        const res = await fetch(apiUrl('/api/units/' + editingUnit.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
      } else {
        const res = await fetch(apiUrl('/api/units'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la unidad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">
            {editingUnit ? 'Editar Unidad' : 'Registrar Unidad'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Placa *</label>
            <input
              type="text"
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
              placeholder="Ej. ABC-123"
              required
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
              required
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
              {loading ? 'Guardando...' : 'Guardar Unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

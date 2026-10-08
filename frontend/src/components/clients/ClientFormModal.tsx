"use client";

import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface ClientFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editingClient?: any;
  allUnits: any[];
}

export function ClientFormModal({ onClose, onSuccess, editingClient, allUnits }: ClientFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: editingClient?.name || '',
    businessName: editingClient?.businessName || '',
    ruc: editingClient?.ruc || '',
    contact: editingClient?.contact || '',
    email: editingClient?.email || '',
    phone: editingClient?.phone || '',
    notes: editingClient?.notes || '',
    active: editingClient ? editingClient.active : true,
  });

  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    editingClient?.units?.map((u: any) => u.id) || []
  );
  
  const [unitSearch, setUnitSearch] = useState('');

  const filteredUnits = allUnits.filter(u => 
    !unitSearch || 
    (u.plate && u.plate.toLowerCase().includes(unitSearch.toLowerCase())) || 
    u.imei.includes(unitSearch)
  );

  const toggleUnit = (unitId: string) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) return setError('El nombre es obligatorio');
    if (formData.ruc.trim() && formData.ruc.trim().length !== 11) return setError('El RUC debe tener 11 dígitos');

    try {
      setLoading(true);
      const url = editingClient ? apiUrl('/api/clients/' + editingClient.id) : apiUrl('/api/clients');
      const method = editingClient ? 'PATCH' : 'POST';
      
      const payload = { ...formData, unitIds: selectedUnits };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {editingClient ? 'Editar Cliente' : 'Registrar Cliente'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Nombre / Razón Social *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                placeholder="Ej. Transportes Ejemplo S.A.C."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">RUC</label>
              <input
                type="text"
                value={formData.ruc}
                onChange={(e) => setFormData({ ...formData, ruc: e.target.value.replace(/\\D/g, '').slice(0, 11) })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                placeholder="11 dígitos"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Contacto</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                placeholder="Nombre del encargado"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Teléfono</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Asignar Unidades ({selectedUnits.length} seleccionadas)</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por placa o IMEI..." 
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary" 
              />
            </div>
            <div className="h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50">
              {filteredUnits.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No se encontraron unidades</div>
              ) : (
                filteredUnits.map(u => (
                  <label key={u.id} className="flex items-center gap-3 p-3 hover:bg-white cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedUnits.includes(u.id)}
                      onChange={() => toggleUnit(u.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-bold text-gray-900">{u.plate || 'Sin placa'} <span className="font-normal text-gray-500 text-xs ml-1">({u.imei})</span></div>
                      <div className="text-xs text-gray-500">
                        {u.client ? (u.client.id === editingClient?.id ? 'Asignada a este cliente' : 'Asignada a: ' + u.client.name) : 'Sin asignar'}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
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
              Cliente activo
            </label>
          </div>

          <div className="pt-4 flex gap-3 border-t border-gray-100 mt-6">
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
              {loading ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

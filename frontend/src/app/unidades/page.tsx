import { Plus, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Unidades() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Unidades</h1>
        <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm cursor-pointer">
          <Plus size={20} /> Registrar Unidad
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="bg-card border border-border px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
          <span className="font-bold text-gray-900 text-lg">0</span>
          <span className="text-muted text-sm font-medium">Registradas</span>
        </div>
        <div className="bg-warning/10 border border-warning/20 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
          <span className="font-bold text-warning text-lg">0</span>
          <span className="text-warning text-sm font-medium">Sin registrar</span>
        </div>
        <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
          <span className="font-bold text-gray-500 text-lg">0</span>
          <span className="text-gray-500 text-sm font-medium">Sin datos recientes</span>
        </div>
      </div>

      {/* Unidades sin registrar */}
      <div>
        <h2 className="text-lg font-bold text-warning mb-3 flex items-center gap-2">
          <AlertCircle size={20} />
          SIN REGISTRAR
        </h2>
        <div className="bg-card rounded-2xl shadow-sm border border-warning/30 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-warning/5 text-warning-dark text-sm border-b border-warning/20">
                <th className="p-4 font-medium">IMEI</th>
                <th className="p-4 font-medium">Primera detección</th>
                <th className="p-4 font-medium">Última trama</th>
                <th className="p-4 font-medium">Tramas</th>
                <th className="p-4 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  No se han detectado nuevas unidades.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Unidades registradas */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">UNIDADES REGISTRADAS</h2>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="text" placeholder="Buscar placa / IMEI..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <select className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700 cursor-pointer">
              <option>Todos los clientes</option>
            </select>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-muted text-sm border-b border-border">
                <th className="p-4 font-medium">Placa</th>
                <th className="p-4 font-medium">IMEI</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Última trama</th>
                <th className="p-4 font-medium">Réplicas</th>
                <th className="p-4 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  No hay unidades registradas.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

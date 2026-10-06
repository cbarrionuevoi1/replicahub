import { Search, RefreshCw, Eye } from 'lucide-react';

export default function Errores() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Errores</h1>
          <p className="text-muted mt-1">Transmisiones fallidas y Dead Letter Queue</p>
        </div>
        <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
          <RefreshCw size={18} /> Reintentar Todos
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-error/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-error/5 text-error-dark text-sm border-b border-error/20">
                <th className="p-4 font-medium">Placa</th>
                <th className="p-4 font-medium">IMEI</th>
                <th className="p-4 font-medium">Repetidor</th>
                <th className="p-4 font-medium">Error</th>
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Intentos</th>
                <th className="p-4 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  No hay errores registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

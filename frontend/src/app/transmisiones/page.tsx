import { Filter, Search } from 'lucide-react';
import TransmissionExportButtons from '@/components/transmissions/TransmissionExportButtons';

export default function Transmisiones() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Transmisiones</h1>
        <TransmissionExportButtons />
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap gap-4 bg-gray-50/50">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Buscar placa / IMEI..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>

          <select className="bg-white border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700 shadow-sm cursor-pointer">
            <option>Cliente: Todos</option>
          </select>

          <select className="bg-white border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700 shadow-sm cursor-pointer">
            <option>Repetidor: Todos</option>
          </select>

          <select className="bg-white border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700 shadow-sm cursor-pointer">
            <option>Resultado: Todos</option>
            <option>Éxito</option>
            <option>Error</option>
          </select>

          <button
            type="button"
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Filter size={18} /> Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-muted text-sm border-b border-border">
                <th className="p-4 font-medium">Fecha/Hora</th>
                <th className="p-4 font-medium">Placa</th>
                <th className="p-4 font-medium">IMEI</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Repetidor</th>
                <th className="p-4 font-medium">Resultado</th>
                <th className="p-4 font-medium">HTTP</th>
                <th className="p-4 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted">
                  No hay transmisiones registradas aún.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

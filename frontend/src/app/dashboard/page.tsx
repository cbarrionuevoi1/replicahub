import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <ArrowDownRight className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">TRAMAS RECIBIDAS</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">0</h3>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="bg-success/20 p-3 rounded-xl">
              <ArrowUpRight className="text-success" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">TRAMAS ENVIADAS</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">0</h3>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="bg-error/20 p-3 rounded-xl">
              <XCircle className="text-error" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">TRAMAS RECHAZADAS</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">0</h3>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 tracking-tight">ESTADO POR REPETIDOR</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-1 md:col-span-2 text-center py-10 bg-card rounded-2xl border border-border">
          <p className="text-muted">Aún no hay unidades asignadas a repetidores</p>
        </div>
      </div>
    </div>
  );
}

import { Server, Activity, Database, Cpu } from 'lucide-react';

export default function Sistema() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Estado del Sistema</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Server className="text-primary" size={24} />
            </div>
            <h3 className="font-bold text-gray-900">TCP Receiver</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">Online</div>
          <p className="text-sm text-success mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success"></span> Escuchando puerto 5000
          </p>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <Database className="text-blue-600" size={24} />
            </div>
            <h3 className="font-bold text-gray-900">PostgreSQL</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">Online</div>
          <p className="text-sm text-muted mt-1">Conectado (4ms ping)</p>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-red-100 p-3 rounded-xl">
              <Activity className="text-red-600" size={24} />
            </div>
            <h3 className="font-bold text-gray-900">Redis / BullMQ</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">Online</div>
          <p className="text-sm text-muted mt-1">0 trabajos en cola</p>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-purple-100 p-3 rounded-xl">
              <Cpu className="text-purple-600" size={24} />
            </div>
            <h3 className="font-bold text-gray-900">Workers</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">4 / 4</div>
          <p className="text-sm text-muted mt-1">Activos</p>
        </div>
      </div>
    </div>
  );
}

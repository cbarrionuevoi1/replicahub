'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  RadioTower,
  RefreshCcw,
  Save,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Truck,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

type Tab = 'resumen' | 'unidades' | 'transmisiones' | 'ajustes';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'transmisiones', label: 'Transmisiones' },
  { id: 'ajustes', label: 'Ajustes' },
];

export default function RepeaterManager() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [showToken, setShowToken] = useState(false);
  const [search, setSearch] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('10000');
  const [retries, setRetries] = useState('3');
  const [notice, setNotice] = useState<string | null>(null);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.id !== 'ajustes' || isAdmin),
    [isAdmin]
  );

  function previewSave() {
    setNotice('Vista previa: los cambios todavía no se guardan en la base de datos.');
    window.setTimeout(() => setNotice(null), 3200);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Gestión de destinos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Repetidores</h1>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          <Clock3 size={15} />
          Vista previa · aún no conectado al servicio de réplica
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-13rem)] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">Destinos</p>
                <p className="text-xs text-muted">1 configurado en diseño</p>
              </div>
              <Server size={19} className="text-primary" />
            </div>

            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar repetidor..."
                className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="flex-1 p-3">
            {(!search || 'sutran'.includes(search.toLowerCase())) && (
              <button
                type="button"
                className="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 text-left transition hover:border-primary/40"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                    <RadioTower size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-900">SUTRAN</p>
                      <ChevronRight size={17} className="text-primary" />
                    </div>
                    <p className="mt-1 text-xs text-muted">Superintendencia de Transporte</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <WifiOff size={12} /> Sin conectar
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                        TOKEN
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>

        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/15">
                  <RadioTower size={24} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">SUTRAN</h2>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-gray-600">
                      SUTRAN
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  Servicio no conectado
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('ajustes')}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-primary/40 hover:text-primary"
                  >
                    <Settings size={15} /> Ajustes
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-border px-6">
            <div className="flex gap-1 overflow-x-auto">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative whitespace-nowrap px-4 py-4 text-sm font-semibold transition ${activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted hover:text-gray-900'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'resumen' && <SummaryView />}
            {activeTab === 'unidades' && <UnitsView />}
            {activeTab === 'transmisiones' && <TransmissionsView />}
            {activeTab === 'ajustes' && isAdmin && (
              <SettingsView
                endpoint={endpoint}
                setEndpoint={setEndpoint}
                token={token}
                setToken={setToken}
                showToken={showToken}
                setShowToken={setShowToken}
                timeoutMs={timeoutMs}
                setTimeoutMs={setTimeoutMs}
                retries={retries}
                setRetries={setRetries}
                onSave={previewSave}
              />
            )}
          </div>
        </section>
      </div>

      {notice && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-xl">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryView() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={<WifiOff size={20} />}
          label="Estado del servicio"
          value="Sin conectar"
          detail="Pendiente de integrar con Repeaters Service"
        />
        <MetricCard
          icon={<Truck size={20} />}
          label="Unidades asignadas"
          value="0"
          detail="Todavía no hay unidades vinculadas"
        />
        <MetricCard
          icon={<Activity size={20} />}
          label="Último envío"
          value="—"
          detail="Sin transmisiones registradas"
        />
        <MetricCard
          icon={<KeyRound size={20} />}
          label="Autenticación"
          value="Token"
          detail="Header: access-token"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Configuración esperada</h3>
              <p className="mt-1 text-xs text-muted">La configuración real se guardará después en PostgreSQL.</p>
            </div>
            <Settings size={19} className="text-gray-400" />
          </div>

          <div className="divide-y divide-border text-sm">
            <InfoRow label="Tipo" value="SUTRAN" />
            <InfoRow label="Método" value="POST" />
            <InfoRow label="Autenticación" value="Token por header" />
            <InfoRow label="Header" value="access-token" mono />
            <InfoRow label="Timeout" value="10 000 ms" />
            <InfoRow label="Reintentos" value="3" />
          </div>
        </div>

        <div className="rounded-2xl border border-border p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Flujo de réplica</h3>
              <p className="mt-1 text-xs text-muted">Cómo quedará conectado cuando integremos los servicios.</p>
            </div>
            <Database size={19} className="text-gray-400" />
          </div>

          <div className="space-y-3">
            {[
              'Posición normalizada por ReplicaHub',
              'Validación de placa y coordenadas',
              'Conversión al formato SUTRAN',
              'Envío con token configurado por ADMIN',
              'Registro de respuesta e intentos',
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitsView() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-col gap-3 border-b border-border bg-gray-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Unidades asignadas a SUTRAN</h3>
        </div>
        <button
          type="button"
          disabled
          className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
        >
          + Asignar unidad
        </button>
      </div>

      <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <Truck size={42} className="mb-4 text-gray-300" />
        <p className="font-semibold text-gray-800">Aún no hay unidades asignadas</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          Cuando creemos la base operacional podrás seleccionar cliente, placa e IMEI y habilitar SUTRAN para cada unidad.
        </p>
      </div>
    </div>
  );
}

function TransmissionsView() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="border-b border-border bg-gray-50/60 p-4">
        <h3 className="font-bold text-gray-900">Últimas transmisiones SUTRAN</h3>
      </div>

      <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <Activity size={42} className="mb-4 text-gray-300" />
        <p className="font-semibold text-gray-800">Sin transmisiones todavía</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          Esta vista se alimentará de las tablas de transmisiones cuando integremos PostgreSQL y el dispatcher.
        </p>
      </div>
    </div>
  );
}

interface SettingsViewProps {
  endpoint: string;
  setEndpoint: (value: string) => void;
  token: string;
  setToken: (value: string) => void;
  showToken: boolean;
  setShowToken: (value: boolean) => void;
  timeoutMs: string;
  setTimeoutMs: (value: string) => void;
  retries: string;
  setRetries: (value: string) => void;
  onSave: () => void;
}

function SettingsView({
  endpoint,
  setEndpoint,
  token,
  setToken,
  showToken,
  setShowToken,
  timeoutMs,
  setTimeoutMs,
  retries,
  setRetries,
  onSave,
}: SettingsViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-2xl border border-border p-5">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Settings size={19} className="text-primary" />
            <h3 className="font-bold text-gray-900">Configuración SUTRAN</h3>
          </div>
          <p className="mt-2 text-sm text-muted">
            Esta vista ya representa cómo el ADMIN configurará el destino. Todavía no persiste información.
          </p>
        </div>

        <div className="space-y-5">
          <Field label="Nombre del repetidor">
            <input
              value="SUTRAN"
              disabled
              className="w-full rounded-xl border border-border bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
            />
          </Field>

          <Field label="Endpoint">
            <input
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Método HTTP">
              <input
                value="POST"
                disabled
                className="w-full rounded-xl border border-border bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-600"
              />
            </Field>
            <Field label="Tipo de autenticación">
              <input
                value="TOKEN_HEADER"
                disabled
                className="w-full rounded-xl border border-border bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-600"
              />
            </Field>
          </div>

          <Field label="Header del token">
            <input
              value="access-token"
              disabled
              className="w-full rounded-xl border border-border bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-600"
            />
          </Field>

          <Field label="Token SUTRAN" helper="Solo los administradores podrán establecer o reemplazar este secreto.">
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Ingresa el token"
                autoComplete="off"
                className="w-full rounded-xl border border-border py-2.5 pl-3 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
              >
                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Timeout (ms)">
              <input
                type="number"
                min="1000"
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </Field>
            <Field label="Máximo de reintentos">
              <input
                type="number"
                min="0"
                max="10"
                value={retries}
                onChange={(event) => setRetries(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              Guardar aún es demostrativo; la persistencia vendrá con las tablas repeaters y repeater_secrets.
            </p>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
            >
              <Save size={17} /> Guardar configuración
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck size={19} />
            <h4 className="font-bold">Seguridad</h4>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            El token no deberá quedar visible en el frontend después de guardarlo. El backend devolverá únicamente el estado “Token configurado”.
          </p>
        </div>

        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 text-gray-800">
            <LockKeyhole size={18} className="text-gray-500" />
            <h4 className="font-bold">Permisos</h4>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <PermissionRow label="Ver SUTRAN" admin operator />
            <PermissionRow label="Asignar unidades" admin operator />
            <PermissionRow label="Activar réplica" admin operator />
            <PermissionRow label="Editar endpoint" admin />
            <PermissionRow label="Modificar token" admin />
          </div>
        </div>

        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-400"
        >
          <RefreshCcw size={16} /> Probar conexión · próximo paso
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-semibold text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-800">{label}</span>
      {children}
      {helper && <span className="mt-1.5 block text-xs text-muted">{helper}</span>}
    </label>
  );
}

function PermissionRow({
  label,
  admin = false,
  operator = false,
}: {
  label: string;
  admin?: boolean;
  operator?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1.5 text-[10px] font-bold">
        {admin && <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">ADMIN</span>}
        {operator && <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-600">OPERATOR</span>}
      </div>
    </div>
  );
}

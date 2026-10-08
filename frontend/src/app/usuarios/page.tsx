'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Check, ChevronDown, Eye, EyeOff, KeyRound, Loader2,
  Pencil, Plus, RefreshCw, RotateCcw, Search, Shield, ShieldCheck,
  Trash2, X,
} from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

type UserRole = 'ADMIN' | 'OPERATOR';
type Dialog = 'create' | 'edit' | 'deactivate' | 'resetPassword' | null;

interface SystemUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLoginAt: string | null;
}

interface UserForm {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  active: boolean;
  password: string;
  confirmPassword: string;
}

const emptyForm = (): UserForm => ({
  name: '', username: '', email: '', role: 'OPERATOR', active: true,
  password: '', confirmPassword: '',
});

const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:bg-gray-100 disabled:text-gray-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700';
const actionClass = 'rounded-lg p-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload &&
      typeof payload.error === 'string' ? payload.error : `Error HTTP ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

const roleActions = [
  { label: 'Ver dashboard', admin: true, operator: true },
  { label: 'Gestionar clientes, unidades y repetidores', admin: true, operator: true },
  { label: 'Consultar y exportar transmisiones', admin: true, operator: true },
  { label: 'Reintentar transmisiones y consultar errores', admin: true, operator: true },
  { label: 'Crear, editar y desactivar usuarios', admin: true, operator: false },
  { label: 'Restablecer contraseñas de usuarios', admin: true, operator: false },
  { label: 'Configuración del sistema y auditoría', admin: true, operator: false },
];

export default function Usuarios() {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  const onApiError = useCallback((err: unknown) => {
    if ((err as { status?: number })?.status === 401) {
      setUser(null);
      router.replace('/login');
    }
  }, [router, setUser]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const list = await requestApi<SystemUser[]>('/api/users');
      if (!Array.isArray(list)) throw new Error('La API devolvió un listado inválido');
      setUsers(list);
    } catch (err) {
      onApiError(err);
      setError(err instanceof Error ? err.message : 'No fue posible consultar usuarios');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, onApiError]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setDialog(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, saving]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return users.filter((item) => {
      const matches = [item.name, item.username, item.email, item.role].some(value =>
        value.toLocaleLowerCase('es').includes(query));
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && item.active) || (statusFilter === 'inactive' && !item.active);
      return matches && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const openDialog = (type: Dialog, target: SystemUser | null = null) => {
    setDialog(type);
    setSelected(target);
    setDialogError('');
    setSuccess('');
    setShowPassword(false);
    setForm(target && type === 'edit' ? {
      name: target.name, username: target.username, email: target.email,
      role: target.role, active: target.active, password: '', confirmPassword: '',
    } : emptyForm());
  };

  const closeDialog = () => { if (!saving) { setDialog(null); setSelected(null); setDialogError(''); } };
  const updateForm = <K extends keyof UserForm>(key: K, value: UserForm[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setDialogError('');
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setDialogError('Completa todos los campos obligatorios.'); return;
    }
    if (dialog === 'create' && (form.password.length < 12 || form.password.length > 128)) {
      setDialogError('La contraseña debe tener entre 12 y 128 caracteres.'); return;
    }
    if (dialog === 'create' && form.password !== form.confirmPassword) {
      setDialogError('Las contraseñas no coinciden.'); return;
    }
    if (dialog === 'edit' && !selected) return;

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), username: form.username.trim(), email: form.email.trim(),
        role: form.role, active: form.active,
      };
      if (dialog === 'create') {
        await requestApi('/api/users', { method: 'POST', body: JSON.stringify({ ...body, password: form.password }) });
        setSuccess(`Usuario «${body.username}» creado correctamente.`);
      } else if (selected) {
        await requestApi(`/api/users/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
        setSuccess(`Usuario «${body.username}» actualizado correctamente.`);
      }
      setDialog(null);
      setSelected(null);
      await loadUsers();
    } catch (err) {
      onApiError(err);
      setDialogError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = async () => {
    if (!selected || saving) return;
    setDialogError('');
    setSaving(true);
    try {
      await requestApi(`/api/users/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
      setDialog(null);
      setSuccess(`Usuario «${selected.username}» desactivado. Se conserva su historial.`);
      setSelected(null);
      await loadUsers();
    } catch (err) {
      onApiError(err);
      setDialogError(err instanceof Error ? err.message : 'No se pudo desactivar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const reactivateUser = async (target: SystemUser) => {
    if (saving) return;
    setSuccess(''); setError(''); setSaving(true);
    try {
      await requestApi(`/api/users/${encodeURIComponent(target.id)}`, {
        method: 'PATCH', body: JSON.stringify({ active: true }),
      });
      setSuccess(`Usuario «${target.username}» reactivado correctamente.`);
      await loadUsers();
    } catch (err) {
      onApiError(err);
      setError(err instanceof Error ? err.message : 'No se pudo reactivar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || saving) return;
    setDialogError('');
    if (form.password.length < 12 || form.password.length > 128) {
      setDialogError('La contraseña debe tener entre 12 y 128 caracteres.'); return;
    }
    if (form.password !== form.confirmPassword) {
      setDialogError('Las contraseñas no coinciden.'); return;
    }
    setSaving(true);
    try {
      await requestApi(`/api/users/${encodeURIComponent(selected.id)}/reset-password`, {
        method: 'POST', body: JSON.stringify({ newPassword: form.password }),
      });
      setDialog(null);
      setSuccess(`Contraseña de «${selected.username}» actualizada. Las sesiones existentes pueden permanecer activas hasta su expiración.`);
      setSelected(null);
    } catch (err) {
      onApiError(err);
      setDialogError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return <div className="flex items-center gap-3 p-6 text-muted"><Loader2 className="animate-spin" size={20} /> Verificando acceso...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Shield className="mx-auto mb-4 text-muted" size={36} />
        <h1 className="text-xl font-bold text-gray-900">Acceso restringido</h1>
        <p className="mt-2 text-muted">Solo los administradores pueden consultar y gestionar los usuarios de ReplicaHub.</p>
        <button type="button" className="mt-6 rounded-xl bg-primary px-4 py-2 text-white" onClick={() => router.replace('/dashboard')}>Volver al dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Usuarios</h1>
          <p className="text-muted mt-1">Cuentas, roles y permisos de acceso a ReplicaHub</p>
        </div>
        <button type="button" onClick={() => openDialog('create')} className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm cursor-pointer">
          <Plus size={19} /> Nuevo Usuario
        </button>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-red-700"><AlertCircle size={18} className="shrink-0" />{error}</div>}
      {success && <div role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><Check size={18} className="shrink-0" />{success}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total usuarios', value: users.length, color: 'text-gray-900' },
          { label: 'Activos', value: users.filter(item => item.active).length, color: 'text-primary' },
          { label: 'Inactivos', value: users.filter(item => !item.active).length, color: 'text-gray-500' },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <p className="text-sm text-muted">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.color}`}>{loading ? '—' : item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
            <input type="search" aria-label="Buscar usuario" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, usuario o correo..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
          </div>
          <select aria-label="Filtrar por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
          </select>
          <button type="button" onClick={() => void loadUsers()} disabled={loading} aria-label="Actualizar listado" title="Actualizar listado" className={`${actionClass} text-muted hover:bg-gray-100`}><RefreshCw size={19} className={loading ? 'animate-spin' : ''} /></button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-muted text-sm border-b border-border">
                <th className="p-4 font-medium">Nombre</th><th className="p-4 font-medium">Usuario</th><th className="p-4 font-medium">Correo</th><th className="p-4 font-medium">Rol</th><th className="p-4 font-medium">Estado</th><th className="p-4 font-medium">Último acceso</th><th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted"><Loader2 className="inline-block animate-spin mr-2" size={18} />Cargando usuarios...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted">{users.length ? 'No se encontraron usuarios con esos filtros.' : 'No hay usuarios registrados.'}</td></tr>
              ) : filteredUsers.map(item => (
                <tr key={item.id} className="border-b border-border/70 last:border-0 hover:bg-gray-50/60 text-sm">
                  <td className="p-4 font-semibold text-gray-900">{item.name}{item.id === user.id && <span className="ml-2 text-xs font-normal text-muted">(Tú)</span>}</td>
                  <td className="p-4 text-gray-700">{item.username}</td>
                  <td className="p-4 text-gray-700">{item.email}</td>
                  <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.role === 'ADMIN' ? 'bg-teal-50 text-teal-800' : 'bg-blue-50 text-blue-700'}`}>{item.role === 'ADMIN' ? 'Administrador' : 'Operador'}</span></td>
                  <td className="p-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.active ? 'text-green-700' : 'text-gray-500'}`}><span className={`h-2 w-2 rounded-full ${item.active ? 'bg-green-500' : 'bg-gray-400'}`} />{item.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="p-4 text-xs text-muted">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('es-PE') : 'Sin acceso'}</td>
                  <td className="p-3"><div className="flex items-center justify-end gap-0.5">
                    <button type="button" aria-label={`Editar ${item.username}`} title="Editar usuario" onClick={() => openDialog('edit', item)} className={`${actionClass} text-primary hover:bg-teal-50`}><Pencil size={17}/></button>
                    <button type="button" aria-label={`Restablecer contraseña de ${item.username}`} title="Restablecer contraseña" onClick={() => openDialog('resetPassword', item)} className={`${actionClass} text-gray-600 hover:bg-gray-100`}><KeyRound size={17}/></button>
                    {item.active ? <button type="button" aria-label={`Desactivar ${item.username}`} title={item.id === user.id ? 'No puedes desactivar tu cuenta' : 'Desactivar usuario'} disabled={item.id === user.id} onClick={() => openDialog('deactivate', item)} className={`${actionClass} text-red-600 hover:bg-red-50`}><Trash2 size={17}/></button> : <button type="button" aria-label={`Reactivar ${item.username}`} title="Reactivar usuario" disabled={saving} onClick={() => void reactivateUser(item)} className={`${actionClass} text-green-700 hover:bg-green-50`}><RotateCcw size={17}/></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setShowPermissions(current => !current)} aria-expanded={showPermissions}>
          <span className="flex items-center gap-2 font-semibold text-gray-900"><ShieldCheck size={20} className="text-primary" /> Permisos por rol</span>
          <ChevronDown size={20} className={`text-muted transition-transform ${showPermissions ? 'rotate-180' : ''}`}/>
        </button>
        <p className="mt-1 text-sm text-muted">Solo existen dos roles: Administrador y Operador. Los permisos son fijos para cada rol.</p>
        {showPermissions && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead><tr className="border-b border-border text-gray-600"><th className="py-3 text-left font-medium">Acción</th><th className="py-3 text-center font-medium">Administrador</th><th className="py-3 text-center font-medium">Operador</th></tr></thead><tbody>{roleActions.map(action => <tr key={action.label} className="border-b border-gray-100 last:border-0"><td className="py-3">{action.label}</td><td className="py-3 text-center text-green-600">{action.admin ? <Check size={18} className="inline" /> : '—'}</td><td className="py-3 text-center text-green-600">{action.operator ? <Check size={18} className="inline" /> : <span className="text-gray-400">—</span>}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-muted">Estos permisos reflejan la configuración prevista en la API. Cada operación debe estar protegida por el backend.</p></div>}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="user-dialog-title" className="text-xl font-bold text-gray-900">{dialog === 'create' ? 'Nuevo usuario' : dialog === 'edit' ? 'Editar usuario' : dialog === 'deactivate' ? 'Desactivar usuario' : 'Restablecer contraseña'}</h2>
                <p className="mt-1 text-sm text-muted">{dialog === 'create' ? 'Crea una cuenta con rol Administrador u Operador.' : selected ? `Cuenta: ${selected.username}` : ''}</p>
              </div>
              <button type="button" aria-label="Cerrar ventana" onClick={closeDialog} disabled={saving} className={`${actionClass} text-gray-500 hover:bg-gray-100`}><X size={20}/></button>
            </div>
            {dialogError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dialogError}</div>}

            {(dialog === 'create' || dialog === 'edit') && (
              <form onSubmit={saveUser} className="space-y-4">
                <div><label className={labelClass} htmlFor="user-name">Nombre completo</label><input id="user-name" className={inputClass} value={form.name} onChange={event => updateForm('name', event.target.value)} required maxLength={150} autoFocus placeholder="Nombre y apellidos"/></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><label className={labelClass} htmlFor="user-username">Nombre de usuario</label><input id="user-username" className={inputClass} value={form.username} onChange={event => updateForm('username', event.target.value)} required maxLength={100} autoComplete="off" placeholder="operador01"/></div>
                  <div><label className={labelClass} htmlFor="user-email">Correo electrónico</label><input id="user-email" className={inputClass} type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} required maxLength={200} placeholder="usuario@empresa.com"/></div>
                </div>
                <div><label className={labelClass} htmlFor="user-role">Rol</label><select id="user-role" className={inputClass} value={form.role} onChange={event => updateForm('role', event.target.value as UserRole)} disabled={dialog === 'edit' && selected?.id === user.id}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option></select><p className="mt-1 text-xs text-muted">Solo Administrador puede gestionar otras cuentas.</p></div>
                {dialog === 'create' && <>
                  <div><label className={labelClass} htmlFor="user-password">Contraseña</label><div className="relative"><input id="user-password" className={`${inputClass} pr-10`} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={event => updateForm('password', event.target.value)} minLength={12} maxLength={128} required placeholder="Mínimo 12 caracteres"/><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-2.5 text-gray-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
                  <div><label className={labelClass} htmlFor="user-confirm">Confirmar contraseña</label><input id="user-confirm" className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={event => updateForm('confirmPassword', event.target.value)} minLength={12} maxLength={128} required /></div>
                </>}
                <label className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={form.active} disabled={dialog === 'edit' && selected?.id === user.id} onChange={event => updateForm('active', event.target.checked)}/>Usuario activo</label>
                <div className="flex justify-end gap-3 border-t border-border pt-4"><button type="button" onClick={closeDialog} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50">Cancelar</button><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">{saving && <Loader2 className="animate-spin" size={17}/>} {dialog === 'create' ? 'Crear usuario' : 'Guardar cambios'}</button></div>
              </form>
            )}

            {dialog === 'deactivate' && selected && <div className="space-y-5"><p className="text-sm text-gray-700">¿Deseas desactivar al usuario <strong>{selected.name}</strong> (<strong>{selected.username}</strong>)? Ya no podrá iniciar sesión ni acceder a la API. Su historial se conservará y podrá reactivarse más adelante.</p><div className="flex justify-end gap-3"><button type="button" onClick={closeDialog} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium">Cancelar</button><button type="button" onClick={() => void deactivateUser()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{saving && <Loader2 size={17} className="animate-spin"/>}Desactivar usuario</button></div></div>}

            {dialog === 'resetPassword' && selected && <form onSubmit={resetPassword} className="space-y-4"><p className="text-sm text-muted">Asigna una nueva contraseña para esta cuenta. No se mostrará ni guardará en el navegador después de enviarla.</p><div><label className={labelClass} htmlFor="reset-new-password">Nueva contraseña</label><input id="reset-new-password" type="password" autoComplete="new-password" className={inputClass} minLength={12} maxLength={128} required autoFocus value={form.password} onChange={event => updateForm('password', event.target.value)} placeholder="Entre 12 y 128 caracteres"/></div><div><label className={labelClass} htmlFor="reset-confirm-password">Confirmar contraseña</label><input id="reset-confirm-password" type="password" autoComplete="new-password" className={inputClass} minLength={12} maxLength={128} required value={form.confirmPassword} onChange={event => updateForm('confirmPassword', event.target.value)}/></div><div className="flex justify-end gap-3 border-t border-border pt-4"><button type="button" onClick={closeDialog} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium">Cancelar</button><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{saving && <Loader2 size={17} className="animate-spin"/>}Actualizar contraseña</button></div></form>}
          </div>
        </div>
      )}
    </div>
  );
}

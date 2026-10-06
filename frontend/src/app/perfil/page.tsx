'use client';

import { useState } from 'react';
import { CheckCircle, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiUrl } from '@/lib/api';

export default function Perfil() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/users/me/password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar contraseña');
      }

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-muted">Cargando perfil...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mi Perfil</h1>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-2xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
            <p className="text-muted">{user.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Usuario</label>
            <div className="font-medium text-gray-900 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              {user.username}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Correo Electrónico
            </label>
            <div className="font-medium text-gray-900 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              {user.email}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <KeyRound size={20} className="text-primary" />
          Cambiar Contraseña
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          {error && (
            <div className="text-error bg-error/10 p-3 rounded-xl border border-error/20 text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="text-success bg-success/10 p-3 rounded-xl border border-success/20 text-sm font-medium flex items-center gap-2">
              <CheckCircle size={16} />
              Contraseña actualizada correctamente
            </div>
          )}

          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña Actual
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}

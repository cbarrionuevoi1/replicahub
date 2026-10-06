'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  Server,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { apiUrl } from '@/lib/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const menuItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', path: '/clientes', icon: Users },
  { name: 'Unidades', path: '/unidades', icon: Truck },
  { name: 'Repetidores', path: '/repetidores', icon: Server },
  { name: 'Transmisiones', path: '/transmisiones', icon: Activity },
  { name: 'Errores', path: '/errores', icon: AlertTriangle },
  { name: 'Usuarios', path: '/usuarios', icon: Users, adminOnly: true },
  { name: 'Sistema', path: '/sistema', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      router.replace('/login');
      setLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 bg-sidebar text-white flex flex-col min-h-screen shadow-xl transition-all duration-300 relative z-20">
      <div className="p-6 font-bold text-2xl tracking-wide flex items-center gap-3 border-b border-white/10">
        <Server className="text-secondary" size={26} />
        ReplicaHub
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-6">
        {menuItems.map((item) => {
          if (item.adminOnly && user?.role !== 'ADMIN') {
            return null;
          }

          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 font-medium'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white',
              )}
            >
              <item.icon
                size={20}
                className={cn(
                  'transition-transform duration-200',
                  isActive
                    ? 'text-white scale-110'
                    : 'text-gray-400 group-hover:scale-110',
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 flex flex-col gap-2">
        {user && (
          <Link
            href="/perfil"
            className="flex items-center gap-3 px-2 py-2 hover:bg-white/5 rounded-xl transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white leading-tight group-hover:text-secondary transition-colors truncate">
                {user.name}
              </span>
              <span className="text-xs text-gray-400">{user.role}</span>
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60 text-left px-2 font-medium cursor-pointer disabled:cursor-not-allowed"
        >
          {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  );
}

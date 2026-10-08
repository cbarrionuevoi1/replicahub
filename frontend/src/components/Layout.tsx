'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { AuthProvider, useAuth } from './AuthProvider';

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isLogin = pathname === '/login';

  if (!isLogin && (loading || !user)) {
    // Evita mostrar páginas protegidas y el menú antes de verificar la sesión.
    return <div className="h-screen flex items-center justify-center bg-background text-muted">Validando sesión...</div>;
  }
  return <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
    {!isLogin && <Sidebar />}
    <main className="flex-1 overflow-y-auto bg-background"><div className="p-8 max-w-7xl mx-auto">{children}</div></main>
  </div>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><Shell>{children}</Shell></AuthProvider>;
}

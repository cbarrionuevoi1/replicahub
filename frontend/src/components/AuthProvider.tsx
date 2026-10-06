'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(pathname !== '/login');

  useEffect(() => {
    // /login tiene su propia comprobación de sesión.
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    // Si el usuario ya fue validado, NO volver a consultar /auth/me
    // por cada cambio de ruta. Esto mantiene montado todo el shell
    // (Sidebar + contenido) y elimina el parpadeo entre secciones.
    if (user) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);

    async function loadSession() {
      try {
        const response = await fetch(apiUrl('/api/auth/me'), {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('SESSION_INVALID');
        }

        const data = (await response.json()) as { user?: AuthUser };

        if (!data.user) {
          throw new Error('SESSION_INVALID');
        }

        if (active) {
          setUser(data.user);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        if (active) {
          setUser(null);
          router.replace('/login');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
      controller.abort();
    };
  }, [pathname, router, user]);

  // IMPORTANTE:
  // Nunca sustituimos toda la aplicación por un spinner mientras
  // se valida la sesión. El layout permanece montado, por lo que
  // Sidebar/Header no desaparecen durante la navegación.
  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }

  return context;
}

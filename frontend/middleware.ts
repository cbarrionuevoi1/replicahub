import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que NO requieren autenticación
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dejar pasar siempre: archivos estáticos, imágenes, api interna de Next
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||          // favicon.ico, fonts, images, etc.
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('accessToken')?.value;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Sin token intentando entrar a ruta protegida → login
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Con token intentando entrar a /login → dashboard
  if (token && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Matcher minimalista: solo rutas de página, nunca archivos estáticos
export const config = {
  matcher: [
    '/dashboard',
    '/clientes/:path*',
    '/unidades/:path*',
    '/repetidores/:path*',
    '/transmisiones/:path*',
    '/errores/:path*',
    '/usuarios/:path*',
    '/sistema/:path*',
    '/perfil/:path*',
    '/login',
  ],
};

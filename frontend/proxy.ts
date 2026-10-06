import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/clientes/:path*',
    '/unidades/:path*',
    '/repetidores/:path*',
    '/transmisiones/:path*',
    '/errores/:path*',
    '/usuarios/:path*',
    '/sistema/:path*',
    '/perfil/:path*',
  ],
};

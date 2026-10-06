ReplicaHub - corrección de parpadeo de navegación

Reemplazar estos 3 archivos:

1. frontend/src/components/AuthProvider.tsx
2. frontend/src/components/Layout.tsx
3. frontend/src/app/login/page.tsx

Causa corregida:
- AuthProvider consultaba /api/auth/me cada vez que cambiaba pathname.
- Mientras consultaba sustituía TODO el árbol de la app por un spinner.
- Eso desmontaba Sidebar + main.
- Al volver a montar, Layout ejecutaba otra vez la animación Framer Motion initial opacity/y.

Resultado:
- la sesión se valida solo cuando hace falta;
- la navegación entre páginas no desmonta el shell;
- Sidebar permanece fijo;
- se elimina la animación vertical global del layout;
- Login guarda el user en AuthContext antes de entrar al Dashboard.

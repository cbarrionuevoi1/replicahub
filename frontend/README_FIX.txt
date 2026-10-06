ReplicaHub frontend fix

Reemplazar/agregar:
- proxy.ts (raiz de frontend)
- src/lib/api.ts
- src/components/AuthProvider.tsx
- src/components/Sidebar.tsx
- src/components/transmissions/TransmissionExportButtons.tsx
- src/app/login/page.tsx
- src/app/perfil/page.tsx
- src/app/transmisiones/page.tsx
- src/app/usuarios/page.tsx

Eliminar:
- middleware.ts (raiz de frontend)
- src/middleware.ts

Opcional para produccion:
NEXT_PUBLIC_API_URL=https://tu-backend

Luego reiniciar Next:
npm run dev

# ReplicaHub - integración del módulo Usuarios

## Archivos modificados

- `src/app/usuarios/page.tsx`: formulario y tabla de usuarios conectados a la API.

El resto de los archivos del frontend se conserva tal como llegó en el ZIP.

## Requisitos

1. Mantener ejecutándose PostgreSQL y el backend de ReplicaHub.
2. Instalar en el backend la versión actualizada que incluye `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` y `POST /api/users/:id/reset-password`.
3. Iniciar sesión con una cuenta que tenga el rol `ADMIN`.
4. Las operaciones de usuarios se envían a `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:4000`) con la cookie de sesión (`credentials: include`).
5. El backend debe autorizar el origen del frontend en `CORS_ORIGINS`.

## Instalación sugerida (Windows)

1. Realiza una copia de seguridad de `frontend/src/app/usuarios/page.tsx`.
2. Sustituye ese archivo por el incluido en este ZIP. No es necesario reemplazar el resto del frontend.
3. En el directorio `frontend`, si no lo hiciste antes: `npm install`.
4. Ejecuta `npm run dev` (o `npm run build` para comprobar la compilación).
5. Abre `http://localhost:3000/usuarios` con una sesión de Administrador.

## Pruebas manuales

- Crear una cuenta `OPERATOR` con contraseña de 12 caracteres o más.
- Confirmar que aparece en la tabla sin refrescar manualmente.
- Salir del sistema e iniciar sesión con esa cuenta; comprobar que **Usuarios** está oculto y que `/usuarios` deniega acceso.
- Volver como ADMIN; editar la cuenta, desactivarla y confirmar que ya no inicia sesión.
- Reactivarla, restablecer su contraseña y volver a probar el inicio de sesión.
- Confirmar que no se puede desactivar la propia cuenta de Administrador.

## Consideraciones

- **Eliminar** significa desactivar la cuenta (soft delete), sin borrar historial.
- Solo se ofrecen roles `ADMIN` y `OPERATOR`.
- Nunca se conecta PostgreSQL directamente desde el navegador: el frontend se comunica con la API Express y esta accede a la base de datos mediante TypeORM.
- El backend entregado anteriormente no revoca automáticamente los JWT existentes al restablecer contraseña. Es una mejora pendiente de seguridad.
- No se efectuó una prueba real contra tu base de datos local o servidor, ya que ese entorno no es accesible desde aquí.

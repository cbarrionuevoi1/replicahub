module.exports = {
  apps: [
    {
      name: 'service-push-replicas',
      script: 'dist/index.js',
      instances: 1, // Fork mode initially as requested
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        // Respeta DRY_RUN del .env (por seguridad por defecto simula).
        NODE_ENV: 'production'
      }
    }
  ]
};

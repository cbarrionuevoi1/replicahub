import dotenv from 'dotenv';
import { Pool } from 'pg';
import { Dispatcher } from './dispatcher';
import { Worker } from './worker';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'replicahub',
});

async function bootstrap() {
  try {
    await pool.query('SELECT 1');
    console.log('[App] Connected to PostgreSQL');
    // Compatibilidad: trabajos PROCESSING de la versión antigua no tenían marca temporal.
    await pool.query(`UPDATE transmissions SET status='RETRY'
      WHERE status='PROCESSING' AND "processingStartedAt" IS NULL`);


    const dispatcher = new Dispatcher(pool);
    const worker = new Worker(pool);

    // Start polling DB for new positions every 3 seconds
    await dispatcher.start(3000);
    
    // Start processing jobs every 1 second
    worker.start(1000);

    console.log(`[App] service-push-replicas is running (DRY_RUN=${process.env.DRY_RUN})`);
  } catch (err) {
    console.error('[App] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();

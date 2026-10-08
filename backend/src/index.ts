import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppDataSource } from './config/database';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || ['supersecret','CHANGE_ME'].includes(process.env.JWT_SECRET))) {
  throw new Error('Configura JWT_SECRET seguro antes de iniciar en producción.');
}
const app = express();
const corsOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:3000'
)
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

import apiRoutes from './routes';
import authRoutes from './auth/auth.routes';

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 4000;

AppDataSource.initialize()
  .then(() => {
    console.log('Data Source has been initialized!');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error during Data Source initialization', err);
  });

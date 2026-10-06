import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Client } from '../entities/Client';
import { Unit } from '../entities/Unit';
import { DetectedUnit } from '../entities/DetectedUnit';
import { Repeater } from '../entities/Repeater';
import { UnitRepeater } from '../entities/UnitRepeater';
import { Position } from '../entities/Position';
import { Transmission } from '../entities/Transmission';
import { RawMessage } from '../entities/RawMessage';
import { User } from '../entities/User';
import { UserSession } from '../entities/UserSession';
import { AuditLog } from '../entities/AuditLog';
import { ReportExport } from '../entities/ReportExport';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'replicahub',
  synchronize: false,
  logging: false,
  entities: [Client, Unit, DetectedUnit, Repeater, UnitRepeater, Position, Transmission, RawMessage, User, UserSession, AuditLog, ReportExport],
  migrations: ['src/migrations/**/*.ts'],
});

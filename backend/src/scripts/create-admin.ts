import 'dotenv/config';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

async function run() {
  await AppDataSource.initialize();
  const name = process.env.ADMIN_NAME || 'Admin';
  const email = process.env.ADMIN_EMAIL || 'admin@replicahub.com';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error('Configura ADMIN_PASSWORD con 12 a 128 caracteres antes de crear el administrador.');
  }

  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: [{ username }, { email }] });
  
  if (existing) {
    console.log('Admin user already exists.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = userRepo.create({
    name,
    email,
    username,
    passwordHash,
    role: UserRole.ADMIN,
    active: true
  });

  await userRepo.save(user);
  console.log(`Admin user created with username: ${username}`);
  process.exit(0);
}

run().catch(console.error);

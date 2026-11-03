import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backend, '.env') });
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.COOKIE_SECURE = 'false';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

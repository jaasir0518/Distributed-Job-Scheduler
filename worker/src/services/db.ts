import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getDirectPostgresUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    return 'postgresql://postgres:password@localhost:5432/distributed_scheduler?schema=public';
  }
  if (databaseUrl.startsWith('prisma+postgres://')) {
    try {
      const url = new URL(databaseUrl);
      const apiKey = url.searchParams.get('api_key');
      if (apiKey) {
        const parts = apiKey.split('.');
        const payloadBase64 = parts.length === 3 ? parts[1] : apiKey;
        const decoded = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed.databaseUrl) {
          const directUrl = new URL(parsed.databaseUrl);
          directUrl.searchParams.set('pgbouncer', 'true');
          return directUrl.toString();
        }
      }
    } catch (e) {
      console.warn('Failed to parse prisma+postgres URL, falling back to original:', e);
    }
  }
  try {
    const url = new URL(databaseUrl);
    url.searchParams.set('pgbouncer', 'true');
    return url.toString();
  } catch (e) {
    return databaseUrl;
  }
}

const connectionString = getDirectPostgresUrl(process.env.DATABASE_URL);
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

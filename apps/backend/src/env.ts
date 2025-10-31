import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
process.env.DATABASE_URL = databaseUrl;

export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl,
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

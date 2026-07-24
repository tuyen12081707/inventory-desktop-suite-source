import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

config({ path: resolve(__dirname, '../../../../.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://inventory:inventory@localhost:5432/inventory?schema=public'),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-only-secret-change-me-now'),
  AI_SECRETS_ENCRYPTION_KEY: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:5173,file://'),
});

export const env = EnvSchema.parse(process.env);

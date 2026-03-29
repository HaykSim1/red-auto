import { z } from 'zod';

const boolFromEnv = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  /** Comma-separated origins; * allows all (dev only). */
  CORS_ORIGINS: z.string().optional().default('*'),
  SEED_ADMIN: boolFromEnv,
  /** Same default as seed script; used to recognize dev admin phone on OTP verify. */
  SEED_ADMIN_PHONE: z.string().optional().default('+37400000000'),
  /**
   * If true, promote SEED_ADMIN_PHONE from user→admin on OTP even when NODE_ENV=production.
   * Use when .env has NODE_ENV=production locally; never enable in real production deploys.
   */
  LOCAL_ADMIN_OTP: boolFromEnv,
  /** Alias for LOCAL_ADMIN_OTP (explicit production bootstrap name). */
  ADMIN_OTP_BOOTSTRAP: boolFromEnv,
  SWAGGER_ENABLED: boolFromEnv,
  /** Log OTP to console instead of SMS (development). */
  OTP_DEV_MODE: boolFromEnv,
  /** Throttler: requests per TTL window (global default). */
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
  /** S3-compatible storage for presigned uploads (optional until uploads used). */
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  /** Expo push (optional). */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  /** `dev` (log only), `twilio`, or `http` webhook — see docs/decisions.md D-011. */
  SMS_PROVIDER: z.preprocess(
    (v) =>
      v === undefined || v === ''
        ? 'dev'
        : String(v).toLowerCase().trim(),
    z.enum(['dev', 'twilio', 'http']),
  ),
  SMS_OTP_MESSAGE_TEMPLATE: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  SMS_HTTP_URL: z.string().optional(),
  /** Default: `{"to":"{{phone}}","message":"{{message}}"}` */
  SMS_HTTP_BODY_JSON: z.string().optional(),
  /** Optional JSON object merged into POST headers (e.g. `{"Authorization":"Bearer …"}`). */
  SMS_HTTP_HEADERS_JSON: z.string().optional(),
  /** Allow `npm run seed` when NODE_ENV=production (dangerous; off by default). */
  ALLOW_DANGEROUS_SEED: boolFromEnv,
  /** Admin email for seed (used by POST /v1/admin/auth/login). */
  SEED_ADMIN_EMAIL: z.string().email().optional().default('admin@zapchast.local'),
  /** Admin password for seed (plain-text; bcrypt-hashed before storing). */
  SEED_ADMIN_PASSWORD: z.string().min(8).optional().default('changeme123'),
  /**
   * If true, allow SMS_PROVIDER=dev (console log OTP only) when NODE_ENV=production.
   * For staging / demos only — never enable on a public production API with real users.
   */
  ALLOW_LOG_ONLY_SMS_IN_PRODUCTION: boolFromEnv,
})
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.OTP_DEV_MODE === true) {
        ctx.addIssue({
          code: 'custom',
          message: 'OTP_DEV_MODE must not be true in production',
          path: ['OTP_DEV_MODE'],
        });
      }
      if (
        data.SMS_PROVIDER === 'dev' &&
        data.ALLOW_LOG_ONLY_SMS_IN_PRODUCTION !== true
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'SMS_PROVIDER must be twilio or http in production (set ALLOW_LOG_ONLY_SMS_IN_PRODUCTION=true only for staging to use log-only OTP)',
          path: ['SMS_PROVIDER'],
        });
      }
      if (data.SMS_PROVIDER === 'twilio') {
        if (!data.TWILIO_ACCOUNT_SID?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'TWILIO_ACCOUNT_SID is required when SMS_PROVIDER=twilio',
            path: ['TWILIO_ACCOUNT_SID'],
          });
        }
        if (!data.TWILIO_AUTH_TOKEN?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'TWILIO_AUTH_TOKEN is required when SMS_PROVIDER=twilio',
            path: ['TWILIO_AUTH_TOKEN'],
          });
        }
        const ms = data.TWILIO_MESSAGING_SERVICE_SID?.trim();
        const from = data.TWILIO_FROM_NUMBER?.trim();
        if (!ms && !from) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER when SMS_PROVIDER=twilio',
            path: ['TWILIO_FROM_NUMBER'],
          });
        }
      }
      if (data.SMS_PROVIDER === 'http') {
        if (!data.SMS_HTTP_URL?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'SMS_HTTP_URL is required when SMS_PROVIDER=http',
            path: ['SMS_HTTP_URL'],
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Environment validation error: ${msg}`);
  }
  return parsed.data;
}

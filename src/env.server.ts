import { z } from "zod";

/**
 * Server environment variables for GOFOFA.
 *
 * Set these in Buddy project variables, CloudPanel PM2 env, or a local `.env`
 * file (never commit real values). See `.env.example` for placeholders.
 */
export const serverEnvSchema = z.object({
  /** MySQL connection string (server-only). */
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("mysql://") || value.startsWith("mysql2://"),
      "DATABASE_URL must be a mysql:// or mysql2:// connection string",
    ),

  /** Session + magic-link token signing secret (min 32 chars). */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  /** Public site URL (Stripe redirects, email links). */
  APP_URL: z.string().url("APP_URL must be a valid URL"),

  /** Stripe secret API key (Phase 2+). */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),

  /** Stripe webhook signing secret (Phase 2+). */
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  /** Stripe publishable key for Payment Element (Phase 2+). */
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),

  /** Resend API key for transactional email (Phase 3+). */
  RESEND_API_KEY: z.string().min(1).optional(),

  /** Resend "from" address, e.g. orders@tableandgrace.com */
  RESEND_FROM_EMAIL: z.string().email().optional(),

  /** Twilio account SID (Phase 4+ SMS). */
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),

  /** Twilio auth token (Phase 4+ SMS). */
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),

  /** Twilio sender phone number in E.164 format. */
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),

  /** Shared secret for CloudPanel cron → /api/jobs/* endpoints. */
  CRON_SECRET: z.string().min(16).optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Documented env var keys for ops runbooks and Buddy setup. */
export const SERVER_ENV_KEYS = {
  required: ["DATABASE_URL", "AUTH_SECRET", "APP_URL"] as const,
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PUBLISHABLE_KEY"] as const,
  email: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] as const,
  sms: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const,
  jobs: ["CRON_SECRET"] as const,
} as const;

let cachedEnv: ServerEnv | undefined;

function readRawEnv(): Record<string, string | undefined> {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_URL: process.env.APP_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
}

/** Validate and return server env. Cached after first successful parse. */
export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    const result = serverEnvSchema.safeParse(readRawEnv());
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid server environment: ${message}`);
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}

/** Reset cached env (tests only). */
export function resetServerEnvCache(): void {
  cachedEnv = undefined;
}

/** True when core vars needed for DB/auth runtime are present. */
export function hasCoreServerEnv(): boolean {
  return serverEnvSchema
    .pick({ DATABASE_URL: true, AUTH_SECRET: true, APP_URL: true })
    .safeParse(readRawEnv()).success;
}

/** True when Stripe vars needed for billing are configured. */
export function hasStripeEnv(): boolean {
  const env = readRawEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PUBLISHABLE_KEY);
}

/** Format validation errors for CLI output. */
export function formatServerEnvErrors(): string | null {
  const result = serverEnvSchema.safeParse(readRawEnv());
  if (result.success) {
    return null;
  }
  return result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

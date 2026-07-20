/**
 * Central configuration module.
 *
 * Loads and validates all environment variables / secrets at import time.
 * Use `config` (not `process.env` directly) everywhere in the server bundle.
 *
 * ┌───────────────────────────── SERVER-ONLY ─────────────────────────────┐
 * │ config supabase.serviceRoleKey                                        │
 * │ config supabase.url                                                   │
 * │ config supabase.publishableKey                                        │
 * │ config yoco.secretKey          (payment gateway)                      │
 * │ config smtp.*                  (transactional email)                  │
 * └───────────────────────────────────────────────────────────────────────┘
 * ┌───────────────── CLIENT-SAFE (bundled by Vite with VITE_ prefix) ─────┐
 * │ config.public.supabaseUrl                                             │
 * │ config.public.supabasePublishableKey                                  │
 * └───────────────────────────────────────────────────────────────────────┘
 */

/* ------------------------------------------------------------------ */
/*   Schema                                                           */
/* ------------------------------------------------------------------ */

export type Config = {
  /** Node environment */
  nodeEnv: "development" | "production" | "test";

  /** ═══════════ Server-only secrets (never shipped to client) ════════ */
  supabase: {
    /** Full Supabase project URL (e.g. https://xxxx.supabase.co) */
    url: string;
    /** Publishable (anon) key – safe to embed on the client, but kept here for server use */
    publishableKey: string;
    /** Service-role key – ❗ NEVER expose to the client */
    serviceRoleKey: string;
    /** Project ID (human-readable slug) */
    projectId: string;
  };

  yoco: {
    /** Yoco secret API key for payment processing (server-only) */
    secretKey: string;
    /** Yoco public API key (safe for client, included for convenience) */
    publicKey: string;
  };

  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };

  /** ═══════════ Public (VITE_*) – safe to expose to the client ════════ */
  public: {
    supabaseUrl: string;
    supabasePublishableKey: string;
    supabaseProjectId: string;
    yocoPublicKey: string;
    appUrl: string;
    appName: string;
  };
};

/* ------------------------------------------------------------------ */
/*   Validation helpers                                                */
/* ------------------------------------------------------------------ */

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `  Check your .env file or deployment secrets.\n` +
        `  If you're running locally, add ${key}=<value> to the .env file.`,
    );
  }
  return value;
}

function optional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback ?? undefined;
}

function optionalInt(key: string, fallback?: number): number | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

/* ------------------------------------------------------------------ */
/*   Build & export config singleton                                   */
/* ------------------------------------------------------------------ */

function buildConfig(): Config {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as Config["nodeEnv"];

  /* ---- Supabase ---- */
  const supabaseUrl = required("SUPABASE_URL");
  const supabasePublishableKey = required("SUPABASE_PUBLISHABLE_KEY");
  const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseProjectId = optional("SUPABASE_PROJECT_ID") ?? "";

  /* ---- Yoco ---- */
  const yocoSecretKey = required("YOCO_SECRET_KEY");
  const yocoPublicKey = required("YOCO_PUBLIC_KEY");

  /* ---- SMTP (optional) ---- */
  const smtpHost = optional("SMTP_HOST");
  const smtpPort = optionalInt("SMTP_PORT");
  const smtpUser = optional("SMTP_USER");
  const smtpPass = optional("SMTP_PASS");
  const smtpFrom = optional("SMTP_FROM");

  /* ---- Public ---- */
  const appUrl = required("VITE_APP_URL", "http://localhost:5173");
  const appName = optional("VITE_APP_NAME") ?? "CareerPath SA";

  return {
    nodeEnv,
    supabase: {
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
      serviceRoleKey: supabaseServiceRoleKey,
      projectId: supabaseProjectId,
    },
    yoco: {
      secretKey: yocoSecretKey,
      publicKey: yocoPublicKey,
    },
    smtp:
      smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom
        ? { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, from: smtpFrom }
        : undefined,
    public: {
      supabaseUrl,
      supabasePublishableKey,
      supabaseProjectId,
      yocoPublicKey,
      appUrl,
      appName,
    },
  };
}

/** Singleton config object – import and use anywhere on the server. */
export const config: Config = buildConfig();
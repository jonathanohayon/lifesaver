import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// npm workspaces run API scripts from apps/api, but the project .env lives at the repo root.
// Load the root .env first so commands like `npm.cmd run db:status` can see DATABASE_URL.
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: rootEnvPath });

// Also load a local apps/api/.env if a developer chooses to use one later.
// dotenv does not override existing variables by default.
dotenv.config();

const boolEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENVIRONMENT: z.enum(['local', 'development', 'staging', 'production']).default('development'),
  DATABASE_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  ENVIRONMENT_LOCK: z.string().optional().default(''),
  PRODUCTION_DATABASE_URL: z.string().optional().default(''),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Product surface separation foundation (v0.5.2). In local dev these can point to
  // localhost pages; in production they should become mydomain.com, app/admin/api subdomains.
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000/landing.html'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3000/admin.html'),
  API_URL: z.string().url().default('http://localhost:4000'),
  PRODUCT_SURFACE_MODE: z.enum(['single-service-local', 'single-service-render', 'subdomain-production-ready']).default('single-service-local'),
  DOMAIN_DEPLOYMENT_MODE: z.enum(['local-development', 'render-single-service', 'split-subdomain-production']).default('local-development'),
  CUSTOMER_ACCESS_MODE: z.enum(['local-testing', 'private-beta', 'customer-ready']).default('local-testing'),
  CUSTOMER_LAUNCH_DOMAIN_LABEL: z.string().default('LIFE.SAVER local'),
  ALLOWED_ORIGINS: z.string().optional().default('').transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean)),
  DASHBOARD_REQUIRE_AUTH: boolEnv.default(false),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(300),
  JSON_BODY_LIMIT: z.string().default('1mb'),
  ENABLE_DEBUG_ROUTES: boolEnv.default(false),
  ALLOW_INSECURE_PRODUCTION_STARTUP: boolEnv.default(false),
  SERVE_WEB_APP: boolEnv.default(false),

  // V2 emergency override. When true, LIFE.SAVER must block every future executor path
  // and force policy logic away from auto-approval. It is intentionally environment-level
  // so an operator can halt autonomy even if database/API state is unhealthy.
  EMERGENCY_SAFE_MODE: boolEnv.default(false),
  EMERGENCY_SAFE_MODE_REASON: z.string().optional().default('Emergency safe mode is active. All executor execution is blocked.'),

  // SaaS onboarding foundation. Keep public signup controllable per environment.
  SAAS_SIGNUP_ENABLED: boolEnv.default(true),


  // PostgreSQL is optional during early local mock mode.
  // When DATABASE_URL is empty, the API still runs with mock data.
  DATABASE_URL: z.string().optional().default(''),
  DATABASE_SSL: boolEnv.default(false),

  CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(10),
  MAX_CHAT_HISTORY_MESSAGES: z.coerce.number().default(12),
  CHAT_REQUIRE_AUTH: boolEnv.default(false),

  // Automatic V1 QA refresh foundation (v0.6.0). These remain read-only: they only refresh Triple Whale metrics and store internal briefs.
  METRICS_AUTO_REFRESH_ENABLED: boolEnv.default(true),
  METRICS_AUTO_REFRESH_STALE_MINUTES: z.coerce.number().default(30),
  BRIEFS_AUTO_GENERATE_ON_READ: boolEnv.default(true),

  // Claude integration. v0.5.2 calls Claude server-side only and falls back safely when no key is configured.
  CLAUDE_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  CLAUDE_API_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  CLAUDE_API_VERSION: z.string().default('2023-06-01'),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
  CLAUDE_MAX_TOKENS: z.coerce.number().default(700),
  CLAUDE_TEMPERATURE: z.coerce.number().default(0.35),
  CLAUDE_DAILY_CHAT_LIMIT: z.coerce.number().default(100),
  CLAUDE_TOOL_MAX_CALLS: z.coerce.number().default(3),
  DRAFT_DAILY_LIMIT: z.coerce.number().default(100),

  // Auth foundation. In production, AUTH_TOKEN_SECRET must be a long random secret.
  AUTH_TOKEN_SECRET: z.string().min(24).default('dev_only_lifesaver_auth_secret_change_before_production'),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().default(60 * 60 * 8),

  // Used to encrypt/decrypt workspace-level external API keys such as Triple Whale.
  // Production must use a long random value stored only as a protected secret.
  APP_ENCRYPTION_KEY: z.string().min(24).default('temporary_dev_key_change_later_32_chars'),

  // Triple Whale read-only validation. This endpoint is published by Triple Whale for API key validation.
  TRIPLE_WHALE_API_BASE_URL: z.string().url().default('https://api.triplewhale.com'),
  TRIPLE_WHALE_VALIDATE_PATH: z.string().default('/api/v2/users/api-keys/me'),

  // Summary page endpoint. v0.3.0 can build the captured Summary payload dynamically
  // from shop/timezone/currency, while TRIPLE_WHALE_SUMMARY_BODY_JSON remains an optional override.
  TRIPLE_WHALE_SUMMARY_PATH: z.string().default('/api/v2/summary-page/get-data'),
  TRIPLE_WHALE_SUMMARY_BODY_JSON: z.string().optional().default(''),
  TRIPLE_WHALE_SHOP_DOMAIN: z.string().default('budclub.com'),
  TRIPLE_WHALE_ADDITIONAL_SHOP_IDS: z.string().optional().default('budclub.com'),
  TRIPLE_WHALE_CURRENCY: z.string().default('USD'),
  TRIPLE_WHALE_TIMEZONE: z.string().default('America/New_York'),
  TRIPLE_WHALE_TIMEZONE_OFFSET: z.string().default('-04:00'),
  TRIPLE_WHALE_SUMMARY_DATE: z.string().optional().default(''),
  TRIPLE_WHALE_SUMMARY_GROUP_BY: z.string().default('hour'),
  TRIPLE_WHALE_TODAY_HOUR: z.string().optional().default(''),

  // Triple Whale Pixel/Attribution probe. v0.5.2 uses the official customer-journey attribution endpoint
  // in read-only mode. Journey data is excluded by default to avoid storing more customer-level detail than needed.
  TRIPLE_WHALE_ATTRIBUTION_PATH: z.string().default('/api/v2/attribution/get-orders-with-journeys-v2'),
  TRIPLE_WHALE_ATTRIBUTION_BODY_JSON: z.string().optional().default(''),
  TRIPLE_WHALE_ATTRIBUTION_DATE: z.string().optional().default(''),
  TRIPLE_WHALE_ATTRIBUTION_PAGE: z.coerce.number().default(1),
  TRIPLE_WHALE_ATTRIBUTION_PAGE_SIZE: z.coerce.number().default(25),
  TRIPLE_WHALE_ATTRIBUTION_EXCLUDE_JOURNEY_DATA: boolEnv.default(true),

  // Worker automation foundation. WORKER_SHARED_SECRET protects internal worker-triggered endpoints.
  // For local development the default is acceptable, but production must set a long random value.
  WORKER_SHARED_SECRET: z.string().min(24).default('dev_only_lifesaver_worker_secret_change_before_production'),
  WORKER_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WORKER_ENABLED: boolEnv.default(false),
  WORKER_TIMEZONE: z.string().default('America/New_York'),
  WORKER_METRICS_CRON: z.string().default('15 * * * *'),
  WORKER_DAILY_BRIEF_CRON: z.string().default('30 8 * * *'),
  WORKER_WEEKLY_SUMMARY_CRON: z.string().default('0 9 * * 1'),
  WORKER_WORKSPACE_ID: z.string().optional().default(''),
  WORKER_USER_ID: z.string().optional().default(''),

  // Phase 9.6 LinkedIn real publish executor. Default-off on purpose: turn on only for an approved, controlled manual publish test.
  CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED: boolEnv.default(false),
  LINKEDIN_API_BASE_URL: z.string().url().default('https://api.linkedin.com'),
  LINKEDIN_API_VERSION: z.string().default('202606'),

  // Phase 9.9 LinkedIn content rollback/unpublish executor. Default-off: turn on only for explicit manual rollback tests.
  CONTENT_PUBLISH_ROLLBACK_EXECUTOR_ENABLED: boolEnv.default(false),

  // Phase 9.10 controlled live test reporting. This phrase must be captured in founder/client approval notes before any real LinkedIn test post.
  CONTENT_PUBLISH_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE: z.string().default('I APPROVE ONE LINKEDIN TEST POST'),

  // Phase 13.2 Gmail support send executor. Default-off on purpose: turn on only for an approved manual support reply send test.
  SUPPORT_SEND_EXECUTOR_ENABLED: boolEnv.default(false),
  GMAIL_API_BASE_URL: z.string().url().default('https://gmail.googleapis.com'),

  // Phase 9.8 content publish rate/post caps. These are conservative LIFE.SAVER safety caps, not claims about LinkedIn's unpublished API limits.
  CONTENT_PUBLISH_MAX_POSTS_PER_DAY: z.coerce.number().int().min(0).default(3),
  CONTENT_PUBLISH_MAX_POSTS_PER_HOUR: z.coerce.number().int().min(0).default(1),
  CONTENT_PUBLISH_ACCOUNT_MAX_POSTS_PER_DAY: z.coerce.number().int().min(0).default(3),
  CONTENT_PUBLISH_ACCOUNT_MAX_POSTS_PER_HOUR: z.coerce.number().int().min(0).default(1),
  LINKEDIN_PUBLISH_MAX_POSTS_PER_DAY: z.coerce.number().int().min(0).default(3),
  LINKEDIN_PUBLISH_MAX_POSTS_PER_HOUR: z.coerce.number().int().min(0).default(1),

  // Kept only for backward compatibility with v0.3.0 custom tests.
  TRIPLE_WHALE_LIVE_TEST_URL: z.string().optional().default(''),
});

export const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  ALLOWED_ORIGINS: parsedEnv.ALLOWED_ORIGINS.length
    ? parsedEnv.ALLOWED_ORIGINS
    : Array.from(new Set([parsedEnv.FRONTEND_URL, parsedEnv.PUBLIC_SITE_URL, parsedEnv.APP_URL, parsedEnv.ADMIN_URL])),
  DASHBOARD_REQUIRE_AUTH: parsedEnv.NODE_ENV === 'production' ? true : parsedEnv.DASHBOARD_REQUIRE_AUTH,
  CHAT_REQUIRE_AUTH: parsedEnv.NODE_ENV === 'production' ? true : parsedEnv.CHAT_REQUIRE_AUTH,
  SAAS_SIGNUP_ENABLED: parsedEnv.NODE_ENV === 'production' ? parsedEnv.SAAS_SIGNUP_ENABLED : parsedEnv.SAAS_SIGNUP_ENABLED,
};

# LIFE.SAVER

AI chief of staff for DTC ecommerce founders — reads a store's commerce data, discusses it in chat, and produces daily and weekly briefs.

## Monorepo layout

npm workspaces:

| Workspace | What it is |
|---|---|
| `apps/api` | Express + TypeScript backend — auth, chat, metrics, briefs, drafts, actions, policies |
| `apps/web` | Static frontend (vanilla JS) — founder dashboard, admin, login |
| `apps/worker` | Scheduled jobs (node-cron) that call protected internal API endpoints |
| `packages/shared` | Shared types and helpers |
| `packages/config` | Shared configuration |
| `database/` | SQL migrations (ordered, idempotent) |
| `docs/` | Specifications, API contracts, deployment and testing notes |
| `scripts/` | Package/consistency check scripts |

## Stack

Node.js · TypeScript (strict) · Express · PostgreSQL · Anthropic Claude API · Triple Whale API

## Getting started

```bash
npm install
cp .env.example .env        # then fill in your own values
npm run db:migrate
npm run dev:api             # API
npm run dev:web             # frontend
npm run dev:worker          # scheduled jobs (optional)
```

## Configuration

Copy `.env.example` and provide your own credentials. Environment-specific templates are also provided:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example` / `.env.production.safe-template`
- `.env.render.example` — hosting on Render
- `.env.supabase-template` — Postgres on Supabase

**Never commit a real `.env`.** Secrets belong in your hosting provider's environment/secret manager.

## Useful scripts

```bash
npm run build            # typecheck + build all workspaces
npm run lint
npm run security:check   # environment/production readiness checks
npm run db:migrate       # apply SQL migrations
npm run db:seed          # seed baseline data
npm run worker:status    # worker configuration status
```

## Notes

This repository was seeded from a prior codebase with a fresh git history: committed secrets, `node_modules/` and build output were removed, and a `.gitignore` was added. Any credentials that existed in the original history must be considered compromised and rotated.

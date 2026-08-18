# LIFE.SAVER README — v0.8.5 Claude Backend Compatibility

Current package: `lifesaver-v0.8.5-claude-backend-compatibility.zip`
Current version: `0.8.5`
Current phase: v0.8.5 — Claude Backend Compatibility
Expected health mode: `v2-functional-0-8-5-claude-backend-compatibility`

## Purpose

v0.8.5 fixes the Claude backend integration after live chat continued returning safe fallback even when Claude env variables were configured.

## Root cause found

The backend Claude client was using the raw `CLAUDE_API_KEY` environment string directly in the `x-api-key` header. This is fragile when a cloud host stores copied values with hidden newlines/spaces, quotes, `Bearer`, or accidental `CLAUDE_API_KEY=` prefix text. It also did not support the standard `ANTHROPIC_API_KEY` fallback.

## Main changes

- Added `ANTHROPIC_API_KEY` backend env support.
- Added server-side Claude key normalization.
- Strips hidden whitespace/newlines, quotes, `Bearer`, and accidental env assignment prefixes.
- Tries unique key candidates from `CLAUDE_API_KEY` and `ANTHROPIC_API_KEY`.
- Retries the alternate candidate if the first unique key returns 401.
- Added protected status endpoint: `GET /api/v1/claude/status`.
- Added protected smoke-test endpoint: `POST /api/v1/claude/smoke-test`.
- Diagnostics never expose the API key.

## Render env values

Use a fresh Claude key and set both names to the same value:

```txt
CLAUDE_API_KEY=sk-ant-api03-your-new-full-key
ANTHROPIC_API_KEY=sk-ant-api03-your-new-full-key
CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_API_VERSION=2023-06-01
CLAUDE_API_BASE_URL=https://api.anthropic.com
```

Do not include quotes, Bearer, extra spaces, line breaks, or `CLAUDE_API_KEY=` inside the value.

## Windows commands

```bash
npm.cmd install
npm.cmd run phase-functional:0-8-5:test
npm.cmd run build
```

## Deploy checks

```txt
https://lifesaveragent.com/api/v1/health
https://lifesaveragent.com/api/v1/claude/status
```

Authenticated smoke test from the browser console:

```js
const token = localStorage.getItem('lifesaver_auth_token');
fetch('/api/v1/claude/smoke-test', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

## Safety

- Server-side Claude only.
- No key exposure.
- No database migration.
- No external write.
- No real executor activation.
- No support sending.
- No ad mutation.
- No content publishing.
- No auto-run.

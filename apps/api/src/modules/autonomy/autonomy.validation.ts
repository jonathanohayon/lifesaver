import { z } from 'zod';
import type { AutonomyActionCategory } from './autonomy.types.js';

export const AUTONOMY_API_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export const AUTONOMY_PAUSE_SCOPE_VALUES = ['all', 'content', 'support', 'ads', 'research', 'dev'] as const;
export type AutonomyPauseScope = typeof AUTONOMY_PAUSE_SCOPE_VALUES[number];

const pauseScopeSchema = z.enum(AUTONOMY_PAUSE_SCOPE_VALUES).default('all');

const pauseBodySchema = z.object({
  scope: pauseScopeSchema.optional().default('all'),
  reason: z.string().trim().max(700).optional().nullable(),
});

export type ParsedAutonomyPauseBody = {
  scope: AutonomyPauseScope;
  reason: string | null;
};

export function parseAutonomyPauseBody(input: unknown): ParsedAutonomyPauseBody {
  const parsed = pauseBodySchema.parse(input || {});
  const reason = typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : null;
  return {
    scope: parsed.scope,
    reason,
  };
}

export function scopeToCategory(scope: AutonomyPauseScope): AutonomyActionCategory | 'all' {
  return scope === 'all' ? 'all' : scope;
}

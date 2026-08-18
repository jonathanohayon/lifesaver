import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentActionDigest, buildContentActionDigestStatus } from './content-action-digest.model.js';
import type { ContentActionDigestEntryInput } from './content-action-digest.types.js';

function parseSampleActions(req: Request): ContentActionDigestEntryInput[] {
  const includeFailure = req.query.includeFailure !== 'false';
  const includeWaiting = req.query.includeWaiting !== 'false';
  const includePublished = req.query.includePublished !== 'false';
  const actions: ContentActionDigestEntryInput[] = [];

  if (includePublished) {
    actions.push({
      actionId: 'act_content_published_preview',
      title: 'LinkedIn founder update',
      actionType: 'content_publish',
      platform: 'linkedin',
      channel: 'linkedin_member_feed',
      status: 'executed',
      riskLevel: 'low',
      publishedAt: '2026-07-06T10:15:00.000Z',
      permalink: 'https://www.linkedin.com/feed/update/urn:li:share:1234567890',
      publishReason: 'Published after the content matched approved style, risk stayed low, and final validation passed.',
      autoApprovalDecision: 'auto_approved',
      finalValidationDecision: 'ready_for_executor_handoff',
    });
  }

  if (includeWaiting) {
    actions.push({
      actionId: 'act_content_waiting_preview',
      title: 'Discount campaign announcement',
      actionType: 'content_publish',
      platform: 'linkedin',
      channel: 'linkedin_member_feed',
      status: 'proposed',
      riskLevel: 'medium',
      createdAt: '2026-07-06T11:00:00.000Z',
      reason: 'Waiting because the discount claim needs founder approval before publishing.',
      autoApprovalDecision: 'manual_review_required',
    });
  }

  if (includeFailure) {
    actions.push({
      actionId: 'act_content_failed_preview',
      title: 'LinkedIn test post retry',
      actionType: 'content_publish',
      platform: 'linkedin',
      channel: 'linkedin_member_feed',
      status: 'failed',
      riskLevel: 'low',
      failedAt: '2026-07-06T12:00:00.000Z',
      failureReason: 'LinkedIn token expired before execution; reconnect is required.',
    });
  }

  return actions;
}

export function getContentActionDigestStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentActionDigestStatus()));
}

export function getContentActionDigestPreview(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildContentActionDigest({
      workspaceId: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : 'workspace_preview',
      digestDate: typeof req.query.digestDate === 'string' ? req.query.digestDate : '2026-07-06T23:59:00.000Z',
      timezone: typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC',
      actions: parseSampleActions(req),
    })));
  } catch (error) {
    return next(error);
  }
}

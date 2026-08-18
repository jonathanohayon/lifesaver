import { query } from '../../db/pool.js';
import type { NormalizedSupportTicket, SupportTicketRow } from './support-readonly-import.types.js';

export async function upsertSupportTicket(params: {
  workspaceId: string;
  userId: string;
  ticket: NormalizedSupportTicket;
  rawProviderPayload: Record<string, unknown>;
}): Promise<SupportTicketRow> {
  const result = await query<SupportTicketRow>(
    `INSERT INTO support_tickets (
       workspace_id,
       provider,
       external_thread_id,
       external_message_id,
       from_email_hint,
       from_name_hint,
       subject,
       snippet,
       received_at,
       status,
       priority,
       category,
       sentiment,
       labels_json,
       raw_provider_payload_json,
       imported_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16)
     ON CONFLICT (workspace_id, provider, external_message_id)
     DO UPDATE SET
       external_thread_id = EXCLUDED.external_thread_id,
       from_email_hint = EXCLUDED.from_email_hint,
       from_name_hint = EXCLUDED.from_name_hint,
       subject = EXCLUDED.subject,
       snippet = EXCLUDED.snippet,
       received_at = EXCLUDED.received_at,
       status = CASE WHEN support_tickets.status IN ('closed', 'archived') THEN support_tickets.status ELSE EXCLUDED.status END,
       priority = EXCLUDED.priority,
       category = EXCLUDED.category,
       sentiment = EXCLUDED.sentiment,
       labels_json = EXCLUDED.labels_json,
       raw_provider_payload_json = EXCLUDED.raw_provider_payload_json,
       imported_by = EXCLUDED.imported_by,
       updated_at = NOW()
     RETURNING
       id,
       workspace_id,
       provider,
       external_thread_id,
       external_message_id,
       from_email_hint,
       from_name_hint,
       subject,
       snippet,
       received_at,
       status,
       priority,
       category,
       sentiment,
       labels_json,
       imported_by,
       imported_at,
       updated_at;`,
    [
      params.workspaceId,
      params.ticket.provider,
      params.ticket.externalThreadId,
      params.ticket.externalMessageId,
      params.ticket.fromEmailHint,
      params.ticket.fromNameHint,
      params.ticket.subject,
      params.ticket.snippet,
      params.ticket.receivedAt,
      params.ticket.status,
      params.ticket.priority,
      params.ticket.category,
      params.ticket.sentiment,
      JSON.stringify(params.ticket.labels),
      JSON.stringify(params.rawProviderPayload),
      params.userId,
    ]
  );
  return result.rows[0];
}

export async function listRecentSupportTickets(workspaceId: string, limit = 25): Promise<SupportTicketRow[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);
  const result = await query<SupportTicketRow>(
    `SELECT
       id,
       workspace_id,
       provider,
       external_thread_id,
       external_message_id,
       from_email_hint,
       from_name_hint,
       subject,
       snippet,
       received_at,
       status,
       priority,
       category,
       sentiment,
       labels_json,
       imported_by,
       imported_at,
       updated_at
     FROM support_tickets
     WHERE workspace_id = $1
     ORDER BY received_at DESC
     LIMIT $2;`,
    [workspaceId, safeLimit]
  );
  return result.rows;
}

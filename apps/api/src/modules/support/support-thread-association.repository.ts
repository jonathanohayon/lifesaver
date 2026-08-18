import { query } from '../../db/pool.js';

export interface SupportThreadAssociationTicketRow {
  id: string;
  workspace_id: string;
  provider: string;
  external_thread_id: string;
  external_message_id: string;
  customer_email: string | null;
  from_email_hint: string | null;
  subject: string | null;
  status: string | null;
  updated_at: Date | null;
}

export async function findSupportTicketForThreadAssociation(params: {
  workspaceId: string;
  provider: 'gmail';
  ticketId: string;
  threadId: string;
}): Promise<SupportThreadAssociationTicketRow | null> {
  const result = await query<SupportThreadAssociationTicketRow>(
    `SELECT
       id,
       workspace_id,
       provider,
       external_thread_id,
       external_message_id,
       customer_email,
       from_email_hint,
       subject,
       status,
       updated_at
     FROM support_tickets
     WHERE workspace_id = $1
       AND provider = $2
       AND (
         id::text = $3
         OR external_message_id = $3
         OR external_thread_id = $4
       )
     ORDER BY
       CASE
         WHEN id::text = $3 THEN 1
         WHEN external_message_id = $3 THEN 2
         WHEN external_thread_id = $4 THEN 3
         ELSE 4
       END,
       updated_at DESC
     LIMIT 1;`,
    [params.workspaceId, params.provider, params.ticketId, params.threadId]
  );
  return result.rows[0] || null;
}
